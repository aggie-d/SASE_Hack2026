import { requireUser } from "@/lib/server/auth";
import { getUserAccounts, getSystemAccount } from "@/lib/server/ledger/accounts";
import { postJournal, debit, credit } from "@/lib/server/ledger/post";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError, ok, route } from "@/lib/server/http";
import type { PaymentMethodItem } from "@/lib/contracts";
import crypto from "node:crypto";

export const POST = route(async (req) => {
  const { userId } = await requireUser();
  const body = (await req.json()) as {
    method?: string;
    amount?: string | number;
    currency?: string;
    net_usd?: number;
    payment_method_id?: string;
  };

  const method = body.method || "card";
  const currency = body.currency || "USD";
  const rawAmount = typeof body.amount === "string" ? parseFloat(body.amount.replace(/[^0-9.]/g, "")) : Number(body.amount || 0);
  const netUsd = typeof body.net_usd === "number" && body.net_usd > 0 ? body.net_usd : rawAmount;
  const paymentMethodId = body.payment_method_id;

  if (rawAmount <= 0) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "Please enter a positive deposit amount.",
    });
  }

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

  // Determine asset and minor units:
  // If depositing in MWK: 1 MWK = 100 tambala (exponent 2)
  // If depositing in foreign currency or USD: we credit USD/USDT (1 USD = 1,000,000 micro-USDT, exponent 6)
  const isMwk = currency === "MWK";
  const asset = isMwk ? "MWK" : "USDT";

  const unitsNumber = isMwk ? Math.round(rawAmount * 100) : Math.round(netUsd * 1_000_000);
  const amountUnits = BigInt(unitsNumber);

  if (amountUnits <= 0n) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "Deposit amount is too small to process.",
    });
  }

  const userAccounts = await getUserAccounts(userId);
  const targetWallet = isMwk ? userAccounts.mwk_wallet : userAccounts.usdt_wallet;
  const clearing = await getSystemAccount("collection_clearing", asset);

  const depositId = crypto.randomUUID();

  // 1. Post double-entry journal atomically to credit user's wallet
  await postJournal({
    operationId: depositId,
    type: "deposit",
    entries: [
      debit(clearing, amountUnits),
      credit(targetWallet, amountUnits),
    ],
  });

  // 2. Record deposit in deposits table
  const providerRef = usedMethod
    ? `card_${usedMethod.subtitle.replace(/[^a-zA-Z0-9]/g, "")}_${depositId.slice(0, 8)}`
    : `dep_${method}_${depositId.slice(0, 8)}`;

  await admin.from("deposits").insert({
    id: depositId,
    user_id: userId,
    method: method === "mobile_money" ? "mobile_money" : "bank_transfer",
    amount_units: amountUnits.toString(),
    asset: asset,
    provider: method === "card" ? "linked_card" : "mock",
    provider_reference: providerRef,
    status: "confirmed",
  });

  // 3. Create notification for the user
  const cardTitle = usedMethod ? `${usedMethod.title} (${usedMethod.subtitle})` : "Linked Card";
  const formattedAmount = isMwk ? `${rawAmount.toLocaleString()} MWK` : `$${netUsd.toFixed(2)} USD`;

  const existingNotifications = (userData.user.user_metadata?.notifications as any[]) || [];
  const newNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Deposit Confirmed",
    message: `Your deposit of ${formattedAmount} from ${cardTitle} was successful.`,
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

  return ok({
    success: true,
    deposit_id: depositId,
    amount: formattedAmount,
    asset,
    net_usd: netUsd,
    payment_method: usedMethod || { title: "Credit/Debit Card", subtitle: "Card" },
  });
});
