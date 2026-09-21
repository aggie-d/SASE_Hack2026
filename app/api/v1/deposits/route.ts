import { requireUser } from "@/lib/server/auth";
import { getUserAccounts, getSystemAccount } from "@/lib/server/ledger/accounts";
import { postJournal, debit, credit } from "@/lib/server/ledger/post";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError, ok, route } from "@/lib/server/http";
import { DEPOSIT_FEE_BPS, priceDeposit } from "@/lib/server/deposit-pricing";
import { FALLBACK_MWK_PER_USDT, getUsdRates, rateToString, RatesUnavailableError } from "@/lib/server/rates";
import type { PaymentMethodItem } from "@/lib/contracts";
import { formatMinorUnits } from "@/lib/contracts/money";
import crypto from "node:crypto";

/**
 * POST /api/v1/deposits — card / bank / mobile-money deposit credited to the
 * USDT wallet (demo: instantly confirmed).
 *
 * Pricing is server-authoritative. The client may send its own preview
 * (`net_usd`, `net_usdt`) but those fields are ignored for the amount we
 * credit: the server re-prices `amount` + `currency` at the rate it fetched
 * itself. If the rate moved since the page loaded, we credit the correct
 * amount silently and return `applied_rate` so the UI can show what was used
 * — no error is thrown for drift (demo choice; production would ask the user
 * to confirm beyond a tolerance).
 */
export const POST = route(async (req) => {
  const { userId } = await requireUser();
  const body = (await req.json()) as {
    method?: string;
    amount?: string | number;
    currency?: string;
    /** Client preview only — never used for the credited amount. */
    net_usd?: number;
    net_usdt?: number;
    payment_method_id?: string;
  };

  const method = body.method || "card";
  const currency = (body.currency || "USD").toUpperCase();
  const paymentMethodId = body.payment_method_id;

  if (body.amount === undefined || body.amount === null || String(body.amount).trim() === "") {
    throw new ApiHttpError("VALIDATION_ERROR", { message: "Please enter a positive deposit amount." });
  }

  // Rates: live feed (or pin) → for MWK only, the frozen demo rate as last resort.
  let ratePerUsd: string;
  let usdtPerUsd: string;
  let rateSource: string;
  try {
    const rates = await getUsdRates();
    const r = rates.rates[currency];
    if (r === undefined) {
      throw new ApiHttpError("VALIDATION_ERROR", { message: `Deposits in ${currency} are not supported.` });
    }
    ratePerUsd = rateToString(r);
    usdtPerUsd = rateToString(rates.rates.USDT ?? 1);
    rateSource = `${rates.source}@${rates.date}`;
  } catch (err) {
    if (!(err instanceof RatesUnavailableError)) throw err;
    if (currency !== "MWK" && currency !== "USD") {
      throw new ApiHttpError("PROVIDER_FAILED", {
        message: "Live exchange rates are unavailable right now. Please try again in a moment.",
      });
    }
    ratePerUsd = currency === "USD" ? "1" : rateToString(Number(FALLBACK_MWK_PER_USDT));
    usdtPerUsd = "1";
    rateSource = "mock";
  }

  const pricing = priceDeposit({ amount: body.amount, currency, ratePerUsd, usdtPerUsd });
  const amountUnits = pricing.usdtUnits;
  // Display-grade numbers for notifications / the legacy response fields.
  const rawAmount = Number(pricing.sourceUnits) / 100;
  const netUsd = Number(pricing.netUsdCents) / 100;

  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData?.user) {
    throw new ApiHttpError("NOT_FOUND", { message: "User account not found." });
  }

  const paymentMethods: PaymentMethodItem[] = userData.user.user_metadata?.payment_methods || [];

  // If method is card, find or verify the linked card
  let usedMethod = paymentMethods.find((m) => m.id === paymentMethodId && m.type === "card");
  if (!usedMethod) {
    usedMethod = paymentMethods.find((m) => m.type === "card");
  }

  if (method === "card" && !usedMethod) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "No linked card found. Please link an account in your profile first.",
    });
  }

  // amountUnits (micro-USDT) was priced above by priceDeposit — bigint end to end.
  if (amountUnits <= 0n) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "Deposit amount is too small to process (less than one cent after the 1% fee).",
    });
  }

  const userAccounts = await getUserAccounts(userId);
  const targetWallet = userAccounts.usdt_wallet;
  const clearing = await getSystemAccount("collection_clearing", "USDT");

  const depositId = crypto.randomUUID();

  // 1. Post double-entry journal atomically to credit user's USDT wallet
  await postJournal({
    operationId: depositId,
    type: "deposit",
    entries: [
      debit(clearing, amountUnits),
      credit(targetWallet, amountUnits),
    ],
  });

  // 2. Record deposit in deposits table. The applied rate rides along in the
  //    reference (no migration for the demo): "…|50000.00MWK@1736.967434/USD|usdt=1.000471|live:jsdelivr@2026-09-20"
  const baseRef = usedMethod
    ? `card_${usedMethod.subtitle.replace(/[^a-zA-Z0-9]/g, "")}_${depositId.slice(0, 8)}`
    : `dep_${method}_${depositId.slice(0, 8)}`;
  const providerRef =
    `${baseRef}|${formatMinorUnits(pricing.sourceUnits, "USD", { code: false }).replace(/,/g, "")}${currency}` +
    `@${pricing.ratePerUsd}/USD|usdt=${pricing.usdtPerUsd}|${rateSource}`;

  await admin.from("deposits").insert({
    id: depositId,
    user_id: userId,
    method: method === "mobile_money" ? "mobile_money" : "bank_transfer",
    amount_units: amountUnits.toString(),
    asset: "USDT",
    provider: method === "card" ? "linked_card" : "mock",
    provider_reference: providerRef,
    status: "confirmed",
  });

  // 3. Create notification for the user
  const cardTitle = usedMethod ? `${usedMethod.title} (${usedMethod.subtitle})` : "Linked Card";
  const formattedDeposit = currency === "USD"
    ? `$${netUsd.toFixed(2)} USD`
    : `${rawAmount.toLocaleString()} ${currency} ($${netUsd.toFixed(2)} USDT)`;

  const existingNotifications = (userData.user.user_metadata?.notifications as unknown[] | undefined) ?? [];
  const newNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Deposit Confirmed",
    message: `Your deposit of ${formattedDeposit} from ${cardTitle} was credited to your USDT Wallet.`,
    time: "Just now",
    unread: true,
    created_at: new Date().toISOString(),
  };

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userData.user.user_metadata,
      notifications: [newNotification, ...existingNotifications],
    },
  });

  const creditedUsdt = formatMinorUnits(amountUnits, "USDT", { code: false });
  return ok({
    success: true,
    deposit_id: depositId,
    amount: `${creditedUsdt} USDT`,
    asset: "USDT",
    /** Exact credit in micro-USDT (string bigint) — the number the ledger posted. */
    amount_units: amountUnits.toString(),
    net_usdt: Number(creditedUsdt.replace(/,/g, "")),
    net_usd: netUsd,
    /** What the server actually priced at; the UI shows this, not its own preview. */
    applied_rate: {
      currency,
      per_usd: pricing.ratePerUsd,
      usdt_per_usd: pricing.usdtPerUsd,
      fee_usd: formatMinorUnits(pricing.feeUsdCents, "USD", { code: false }),
      fee_bps: DEPOSIT_FEE_BPS,
      source: rateSource,
    },
    target_wallet: "USDT Wallet",
    payment_method: usedMethod || { title: "Credit/Debit Card", subtitle: "Card" },
  });
});
