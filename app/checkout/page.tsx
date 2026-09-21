"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  RotateCcw,
  ShoppingBag,
  Store,
  XCircle,
} from "lucide-react";
import type {
  ApiError,
  CardResponse,
  CardsResponse,
  CheckoutRequest,
  CheckoutResponse,
  ErrorCode,
  RefundResponse,
  WalletBalance,
} from "@/lib/contracts";
import { formatMinorUnits, parseMinorUnits, toMinorUnits } from "@/lib/contracts/money";

/**
 * Simulated merchant checkout.
 *
 * This page is styled as a third-party shop, not as the wallet, so the demo
 * reads as "paying a merchant with my LAD card". Behind the Pay button it
 * calls POST /api/v1/demo/checkout, which authorises and captures against the
 * card_funding account. Declines come back as 422 ApiError and are shown as a
 * card-declined screen; a captured purchase can be refunded from the receipt.
 */

const MERCHANT = {
  name: "Lilongwe Tech Store",
  tagline: "Electronics · Airtime · Books",
  location: "Area 3, Lilongwe · Online",
};

type Product = {
  id: string;
  name: string;
  detail: string;
  emoji: string;
  /** Micro-USDT (exponent 6). The card is USDT-funded; 1 USDT = 1 USD. */
  priceUnits: bigint;
};

const PRODUCTS: Product[] = [
  { id: "data", name: "Airtel 10GB data bundle", detail: "30-day validity", emoji: "📶", priceUnits: 8_000_000n },
  { id: "earbuds", name: "Wireless earbuds", detail: "Bluetooth 5.3, USB-C", emoji: "🎧", priceUnits: 24_990_000n },
  { id: "textbook", name: "Engineering Mathematics", detail: "7th edition, paperback", emoji: "📘", priceUnits: 45_000_000n },
  { id: "laptop", name: "Refurbished laptop", detail: "14\" · 8GB · 256GB SSD", emoji: "💻", priceUnits: 320_000_000n },
];

type Stage =
  | { kind: "shop" }
  | { kind: "paying" }
  | { kind: "approved"; result: CheckoutResponse; refunded?: RefundResponse; refunding?: boolean; refundError?: string }
  | { kind: "declined"; code: ErrorCode | "NETWORK"; message: string };

const DECLINE_COPY: Partial<Record<ErrorCode, { title: string; hint: string }>> = {
  INSUFFICIENT_FUNDS: {
    title: "Insufficient funds",
    hint: "Your card balance is lower than this purchase. Fund your card from the dashboard and try again.",
  },
  CARD_FROZEN: {
    title: "Card is frozen",
    hint: "This card is frozen or closed. Unfreeze it from your wallet, then retry.",
  },
  LIMIT_EXCEEDED: {
    title: "Over your per-transaction limit",
    hint: "This purchase is above the spending limit you set on the card. Raise the limit or pick a smaller item.",
  },
  FORBIDDEN: {
    title: "Account not verified",
    hint: "Complete verification in your profile before spending with the card.",
  },
};

type CardLoadState = "loading" | "ready" | "none" | "unauthed" | "error";
type LoadedCard = { card: CardResponse | null; state: CardLoadState };

/** GET /api/v1/cards → the caller's (single) card, or why there isn't one. */
async function fetchCard(): Promise<LoadedCard> {
  try {
    const res = await fetch("/api/v1/cards");
    if (res.status === 401) return { card: null, state: "unauthed" };
    if (!res.ok) return { card: null, state: "error" };
    const data = (await res.json()) as CardsResponse;
    const first = data.cards?.[0] ?? null;
    return { card: first, state: first ? "ready" : "none" };
  } catch {
    return { card: null, state: "error" };
  }
}

/** Merchant-side price: the shop charges in dollars. */
function usd(units: bigint): string {
  return `$${formatMinorUnits(units, "USDT", { code: false })}`;
}

function usdFromWire(value: string): string {
  return usd(parseMinorUnits(value));
}

/** Card-side balance: the card is funded in USDT, so it carries the tether sign. */
function usdt(units: bigint): string {
  return `₮${formatMinorUnits(units, "USDT", { code: false })} USDT`;
}

export default function CheckoutPage() {
  const [card, setCard] = useState<CardResponse | null>(null);
  const [cardState, setCardState] = useState<CardLoadState>("loading");
  const [selectedId, setSelectedId] = useState<string>(PRODUCTS[0].id);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "shop" });

  const applyCard = useCallback((loaded: LoadedCard) => {
    setCard(loaded.card);
    setCardState(loaded.state);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCard().then((loaded) => {
      if (!cancelled) applyCard(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [applyCard]);

  // Refresh after a payment/refund so the "available on card" figure is current.
  const loadCard = useCallback(() => fetchCard().then(applyCard), [applyCard]);

  const selectedProduct = useMemo(
    () => PRODUCTS.find((p) => p.id === selectedId) ?? null,
    [selectedId],
  );

  // Total in micro-USDT: a catalogue item, or the custom amount if chosen.
  const totalUnits: bigint | null = useMemo(() => {
    if (selectedId !== "custom") return selectedProduct?.priceUnits ?? null;
    if (customAmount.trim() === "") return null;
    try {
      const units = toMinorUnits(customAmount, "USD") * 10_000n; // cents → micro-USDT
      return units > 0n ? units : null;
    } catch {
      return null;
    }
  }, [selectedId, selectedProduct, customAmount]);

  const merchantLabel =
    selectedId === "custom" || !selectedProduct
      ? MERCHANT.name
      : `${MERCHANT.name} · ${selectedProduct.name}`;

  const availableUnits = card ? parseMinorUnits(card.funding.available_units) : 0n;
  const canPay = cardState === "ready" && card?.status === "active" && totalUnits !== null && stage.kind === "shop";

  const handleCustomChange = (value: string) => {
    setCustomAmount(value);
    setSelectedId("custom");
    if (value.trim() === "") {
      setCustomError(null);
      return;
    }
    try {
      const units = toMinorUnits(value, "USD");
      setCustomError(units > 0n ? null : "Enter an amount above $0.00");
    } catch {
      setCustomError("Use dollars and cents, e.g. 12.50");
    }
  };

  const handlePay = async () => {
    if (!card || totalUnits === null) return;
    setStage({ kind: "paying" });

    const body: CheckoutRequest = {
      card_id: card.card_id,
      merchant: merchantLabel,
      amount_units: totalUnits.toString(),
    };

    try {
      // Tiny pause so the "contacting issuer" state is visible in the demo.
      const [res] = await Promise.all([
        fetch("/api/v1/demo/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(body),
        }),
        new Promise((r) => setTimeout(r, 900)),
      ]);

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as ApiError | null;
        setStage({
          kind: "declined",
          code: err?.error?.code ?? "NETWORK",
          message: err?.error?.message ?? `Payment failed (${res.status}).`,
        });
        return;
      }

      const result = (await res.json()) as CheckoutResponse;
      setStage({ kind: "approved", result });
      // Refresh the card so the funding balance in the header is current.
      loadCard();
    } catch {
      setStage({
        kind: "declined",
        code: "NETWORK",
        message: "Could not reach the payment network. Please try again.",
      });
    }
  };

  const handleRefund = async () => {
    if (stage.kind !== "approved" || stage.refunded || stage.refunding) return;
    setStage({ ...stage, refunding: true, refundError: undefined });
    try {
      const res = await fetch(
        `/api/v1/demo/checkout/${stage.result.authorization.authorization_id}/refund`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as ApiError | null;
        setStage({
          ...stage,
          refunding: false,
          refundError: err?.error?.message ?? `Refund failed (${res.status}).`,
        });
        return;
      }
      const refunded = (await res.json()) as RefundResponse;
      setStage({ ...stage, refunding: false, refunded });
      loadCard();
    } catch {
      setStage({ ...stage, refunding: false, refundError: "Could not reach the merchant. Try again." });
    }
  };

  const backToShop = () => setStage({ kind: "shop" });

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-slate-900 font-sans flex flex-col">
      {/* Merchant header — deliberately not the LAD header: this is "someone else's shop". */}
      <header className="w-full bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold tracking-tight text-lg leading-tight">{MERCHANT.name}</p>
              <p className="text-xs text-slate-500">{MERCHANT.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Simulated merchant · demo
            </span>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to wallet
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {stage.kind === "approved" ? (
          <ApprovedScreen stage={stage} cardLast4={card?.last4 ?? "····"} onRefund={handleRefund} onBack={backToShop} />
        ) : stage.kind === "declined" ? (
          <DeclinedScreen stage={stage} onBack={backToShop} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
            {/* Catalogue */}
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-5">
                <ShoppingBag className="w-5 h-5 text-slate-700" />
                <h1 className="text-xl font-extrabold tracking-tight">Choose an item</h1>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRODUCTS.map((p) => {
                  const selected = selectedId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      disabled={stage.kind === "paying"}
                      className={`text-left rounded-2xl border-2 p-4 transition-all flex gap-3 items-start ${
                        selected
                          ? "border-slate-900 bg-slate-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="text-3xl leading-none">{p.emoji}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-sm text-slate-900 truncate">{p.name}</span>
                        <span className="block text-xs text-slate-500">{p.detail}</span>
                        <span className="block mt-2 font-extrabold text-base">{usd(p.priceUnits)}</span>
                      </span>
                    </button>
                  );
                })}

                {/* Custom amount */}
                <div
                  className={`rounded-2xl border-2 p-4 transition-all sm:col-span-2 ${
                    selectedId === "custom" ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                    Or pay a custom amount
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-slate-500">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customAmount}
                      onFocus={() => setSelectedId("custom")}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      placeholder="0.00"
                      disabled={stage.kind === "paying"}
                      className="flex-1 rounded-xl border border-slate-300 focus:border-slate-900 px-3 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  {customError && selectedId === "custom" && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium">{customError}</p>
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Try an amount above your card balance to see a decline.
                  </p>
                </div>
              </div>
            </section>

            {/* Payment panel */}
            <aside className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 lg:sticky lg:top-6">
              <h2 className="text-base font-extrabold tracking-tight mb-4">Order summary</h2>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 truncate">
                    {selectedId === "custom" ? "Custom amount" : selectedProduct?.name}
                  </span>
                  <span className="font-semibold shrink-0">{totalUnits !== null ? usd(totalUnits) : "—"}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Card fees</span>
                  <span>$0.00</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="font-bold">Total</span>
                  <span className="text-2xl font-extrabold tracking-tight">
                    {totalUnits !== null ? usd(totalUnits) : "—"}
                  </span>
                </div>
              </div>

              {/* Payment method: the LAD card */}
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Pay with</p>
                <PaymentMethodCard card={card} state={cardState} availableUnits={availableUnits} />
              </div>

              <button
                type="button"
                onClick={handlePay}
                disabled={!canPay}
                className="mt-5 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_6px_20px_rgba(201,162,39,0.3)] hover:shadow-[0_8px_25px_rgba(201,162,39,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {stage.kind === "paying" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Contacting card issuer…</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay {totalUnits !== null ? usd(totalUnits) : ""}</span>
                  </>
                )}
              </button>

              <p className="mt-3 text-[11px] text-slate-500 text-center leading-relaxed">
                Authorised and captured instantly on LAD Transfer&apos;s ledger. No real money moves.
              </p>
            </aside>
          </div>
        )}
      </main>

      <footer className="py-5 text-center text-xs text-slate-400">
        <p>{MERCHANT.location} · Payments powered by LAD Transfer (demo)</p>
      </footer>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PaymentMethodCard({
  card,
  state,
  availableUnits,
}: {
  card: CardResponse | null;
  state: CardLoadState;
  availableUnits: bigint;
}) {
  if (state === "loading") {
    return (
      <div className="rounded-2xl border border-slate-200 p-4 flex items-center gap-3 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your LAD card…
      </div>
    );
  }
  if (state === "unauthed") {
    return (
      <Notice tone="amber" title="Sign in to pay">
        You need to be signed in to LAD Transfer to use your card.{" "}
        <Link href="/login" className="font-bold underline">Sign in</Link>
      </Notice>
    );
  }
  if (state === "none") {
    return (
      <Notice tone="amber" title="No LAD card yet">
        Open your <Link href="/dashboard" className="font-bold underline">dashboard</Link> once to create your
        virtual card, then come back.
      </Notice>
    );
  }
  if (state === "error" || !card) {
    return <Notice tone="red" title="Couldn’t load your card">Refresh the page to try again.</Notice>;
  }

  const frozen = card.status !== "active";
  return (
    <div className="rounded-2xl border border-slate-200 p-4 bg-gradient-to-br from-[#0B1528] to-[#16213E] text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[#DFB338]" />
          </div>
          <div>
            <p className="text-xs text-slate-300">LAD Transfer virtual card</p>
            <p className="font-mono font-bold tracking-widest text-sm">•••• {card.last4}</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
            frozen ? "bg-red-500/20 border-red-400/40 text-red-200" : "bg-green-500/20 border-green-400/40 text-green-200"
          }`}
        >
          {frozen ? card.status.toUpperCase() : "ACTIVE"}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-baseline text-xs">
        <span className="text-slate-300">Available on card</span>
        <span className="font-extrabold text-base">{usdt(availableUnits)}</span>
      </div>
    </div>
  );
}

function Notice({ tone, title, children }: { tone: "amber" | "red"; title: string; children: React.ReactNode }) {
  const cls =
    tone === "amber"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-red-50 border-red-200 text-red-800";
  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 text-xs ${cls}`}>
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold text-right ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</span>
    </div>
  );
}

function fundingLine(funding: WalletBalance): string {
  return usdt(parseMinorUnits(funding.available_units));
}

function ApprovedScreen({
  stage,
  cardLast4,
  onRefund,
  onBack,
}: {
  stage: Extract<Stage, { kind: "approved" }>;
  cardLast4: string;
  onRefund: () => void;
  onBack: () => void;
}) {
  const { authorization } = stage.result;
  const refunded = stage.refunded;
  const fundingNow = refunded ? refunded.funding : stage.result.funding;

  return (
    <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
      <div
        className={`w-16 h-16 rounded-3xl border flex items-center justify-center mx-auto mb-4 ${
          refunded ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-green-50 border-green-200 text-green-600"
        }`}
      >
        {refunded ? <RotateCcw className="w-8 h-8" /> : <CheckCircle2 className="w-9 h-9" />}
      </div>
      <h2 className="text-2xl font-extrabold tracking-tight mb-1">
        {refunded ? "Refund issued" : "Payment approved"}
      </h2>
      <p className="text-sm text-slate-600 mb-6">
        {refunded
          ? "The merchant refunded this purchase. The amount is back on your card."
          : `Thanks for shopping at ${MERCHANT.name}.`}
      </p>

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5 text-left mb-5">
        <ReceiptRow label="Merchant" value={authorization.merchant} />
        <ReceiptRow
          label={refunded ? "Amount refunded" : "Amount charged"}
          value={`${refunded ? "+" : "−"}${usdFromWire(authorization.amount.amount_units)}`}
        />
        <ReceiptRow label="Card" value={`LAD virtual •••• ${cardLast4}`} />
        <ReceiptRow label="Status" value={refunded ? "Refunded" : "Captured"} />
        <ReceiptRow label="Card balance now" value={fundingLine(fundingNow)} />
        <div className="pt-2 border-t border-slate-200">
          <ReceiptRow label="Authorization" value={authorization.authorization_id} mono />
        </div>
      </div>

      {stage.refundError && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{stage.refundError}</span>
        </div>
      )}

      <div className="space-y-2.5">
        {!refunded && (
          <button
            type="button"
            onClick={onRefund}
            disabled={stage.refunding}
            className="w-full py-3 px-4 rounded-xl border-2 border-slate-900 font-bold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {stage.refunding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            <span>{stage.refunding ? "Refunding…" : "Merchant: refund this purchase"}</span>
          </button>
        )}
        <Link
          href="/dashboard"
          className="block w-full py-3 px-4 rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-md hover:brightness-105 transition-all text-sm"
        >
          View in my wallet
        </Link>
        <button
          type="button"
          onClick={onBack}
          className="w-full py-2.5 px-4 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer"
        >
          Continue shopping
        </button>
      </div>
    </div>
  );
}

function DeclinedScreen({
  stage,
  onBack,
}: {
  stage: Extract<Stage, { kind: "declined" }>;
  onBack: () => void;
}) {
  const copy = stage.code !== "NETWORK" ? DECLINE_COPY[stage.code] : undefined;
  const title = copy?.title ?? "Payment declined";
  const hint = copy?.hint ?? stage.message;
  const needsFunds = stage.code === "INSUFFICIENT_FUNDS";

  return (
    <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="w-16 h-16 rounded-3xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mx-auto mb-4">
        <XCircle className="w-9 h-9" />
      </div>
      <h2 className="text-2xl font-extrabold tracking-tight mb-1">{title}</h2>
      <p className="text-sm text-slate-600 mb-2">{hint}</p>
      <p className="text-[11px] font-mono text-slate-400 mb-6">
        {stage.code} · {stage.message}
      </p>

      <div className="space-y-2.5">
        {needsFunds && (
          <Link
            href="/dashboard"
            className="block w-full py-3 px-4 rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-md hover:brightness-105 transition-all text-sm"
          >
            Fund my card
          </Link>
        )}
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 transition-colors text-sm cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
