"use client";

import { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  ArrowRight,
  Wallet,
} from "lucide-react";
import {
  toMinorUnits,
  formatMinorUnits,
  parseMinorUnits,
} from "@/lib/contracts/money";
import type { FundCardResponse, RatesResponse } from "@/lib/contracts";

/** "$0.9995" — USD value of 1 USDT from the live USDT-per-USD rate. */
function usdPerUsdt(usdtPerUsd: number): string {
  return (1 / usdtPerUsd).toFixed(4);
}

interface FundCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cardId: string | null;
  cardLast4: string;
  currentCardBalanceUsd: string;
  availableUsdtUnits: bigint;
}

export function FundCardModal({
  isOpen,
  onClose,
  onSuccess,
  cardId,
  cardLast4,
  currentCardBalanceUsd,
  availableUsdtUnits,
}: FundCardModalProps) {
  const [usdtAmount, setUsdtAmount] = useState<string>("");

  // Loading & stage state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success state
  const [successData, setSuccessData] = useState<{
    amountUsd: string;
    newCardBalanceUsd: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(5);

  // Live USDT/USD reference rate for the labels. Funding is USDT → USDT (no
  // FX happens), so this is informational: it stops us calling USDT "USD".
  const [usdtPerUsd, setUsdtPerUsd] = useState<number | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/v1/rates?symbols=USDT")
      .then((r) => (r.ok ? (r.json() as Promise<RatesResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled && typeof d.rates.USDT === "number") setUsdtPerUsd(d.rates.USDT);
      })
      .catch(() => {
        /* label falls back to "USD-pegged" */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleDone = () => {
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/dashboard") {
        window.location.reload();
      } else {
        window.location.href = "/dashboard";
      }
    }
  };

  // 5-second countdown timer when success screen appears, automatically reloading and leading to dashboard
  useEffect(() => {
    if (!successData) {
      setCountdown(5);
      return;
    }

    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [successData]);

  // Auto-resolving card state in case props are not yet loaded
  const [activeCardId, setActiveCardId] = useState<string | null>(cardId);
  const [activeLast4, setActiveLast4] = useState<string>(cardLast4);
  const [activeCardBalance, setActiveCardBalance] = useState<string>(currentCardBalanceUsd);

  useEffect(() => {
    if (cardId) setActiveCardId(cardId);
    if (cardLast4) setActiveLast4(cardLast4);
    if (currentCardBalanceUsd) setActiveCardBalance(currentCardBalanceUsd);
  }, [cardId, cardLast4, currentCardBalanceUsd]);

  // Reset states and prefetch virtual card ONLY when opening modal
  useEffect(() => {
    if (isOpen) {
      // Guard against resetting while showing active success screen
      if (!successData) {
        setErrorMsg(null);
        setIsLoading(false);
        setCountdown(5);
      }

      if (!cardId && !activeCardId) {
        fetch("/api/v1/cards")
          .then((res) => res.json())
          .then((data) => {
            if (data?.cards && data.cards.length > 0) {
              const c = data.cards[0];
              setActiveCardId(c.id);
              if (c.last4) setActiveLast4(c.last4);
              if (c.funding?.available_units) {
                const bal = formatMinorUnits(parseMinorUnits(c.funding.available_units), "USDT", { code: false });
                setActiveCardBalance(bal);
              }
            }
          })
          .catch((err) => {
            console.warn("Could not pre-fetch card:", err);
          });
      }
    } else {
      setSuccessData(null);
      setErrorMsg(null);
      setIsLoading(false);
      setUsdtAmount("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // Real-time calculations for USDT top-up
  const cleanUsdt = usdtAmount.replace(/[^0-9.]/g, "");
  const rawUsdtNumber = parseFloat(cleanUsdt) || 0;
  const currentCardNum = parseFloat(activeCardBalance || currentCardBalanceUsd) || 0;
  const projectedCardBalance = (currentCardNum + rawUsdtNumber).toFixed(2);

  const handleFundCard = async () => {
    setErrorMsg(null);
    let targetCardId = activeCardId || cardId;

    if (!targetCardId) {
      setIsLoading(true);
      setLoadingStage("Finding virtual card...");
      try {
        const res = await fetch("/api/v1/cards");
        if (res.ok) {
          const data = await res.json();
          if (data?.cards && data.cards.length > 0) {
            targetCardId = data.cards[0].id;
            setActiveCardId(targetCardId);
          }
        }
      } catch (e) {
        console.warn("Error auto-fetching card on submit:", e);
      }
    }

    if (!targetCardId) {
      setErrorMsg("No active virtual card found to fund. Please reload the dashboard.");
      setIsLoading(false);
      setLoadingStage("");
      return;
    }

    if (rawUsdtNumber <= 0) {
      setErrorMsg("Please enter a valid top-up amount.");
      return;
    }

    const usdtUnits = toMinorUnits(cleanUsdt, "USDT");
    if (usdtUnits > availableUsdtUnits) {
      setErrorMsg("Amount exceeds your available USDT wallet balance.");
      return;
    }

    setIsLoading(true);
    setLoadingStage("Topping up virtual card from USDT wallet...");

    try {
      const fundRes = await fetch(`/api/v1/cards/${targetCardId}/fund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          amount_units: usdtUnits.toString(),
        }),
      });

      if (!fundRes.ok) {
        const errData = await fundRes.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Failed to top up virtual card.");
      }

      const fundData = (await fundRes.json()) as FundCardResponse;
      const fundedAmount = formatMinorUnits(parseMinorUnits(fundData.amount.amount_units), "USDT", {
        code: false,
      });

      const newFundingBalance = formatMinorUnits(
        parseMinorUnits(fundData.funding.available_units),
        "USDT",
        { code: false }
      );

      setSuccessData({
        amountUsd: fundedAmount,
        newCardBalanceUsd: newFundingBalance,
      });
      onSuccess();
    } catch (err: any) {
      console.error("Card funding error:", err);
      setErrorMsg(err.message || "An unexpected error occurred while funding your card.");
    } finally {
      setIsLoading(false);
      setLoadingStage("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-[#0B1528] rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.5)] border border-slate-700/60 transform animate-in zoom-in-95 duration-200 relative text-white my-auto overflow-hidden">
        {/* Modal Content / Success State */}
        {successData ? (
          <div className="p-6 sm:p-8 flex flex-col items-center text-center overflow-y-auto custom-scrollbar flex-1 relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={handleDone}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-3xl bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 mb-4 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-2xl font-extrabold text-white mb-1">Card Funded!</h3>
            <p className="text-sm text-slate-400 mb-6">
              Your virtual card is loaded and ready for online spending.
            </p>

            {/* Summary Box */}
            <div className="w-full bg-[#070e1c] rounded-2xl p-4 border border-slate-800 mb-5 space-y-3 text-sm">
              <div className="flex justify-between items-center text-slate-400">
                <span>Funded Amount:</span>
                <span className="font-bold text-green-400 text-base">
                  +₮{successData.amountUsd} USDT
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Source:</span>
                <span className="font-medium text-teal-400 flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" />
                  USDT Wallet
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Destination:</span>
                <span className="font-mono text-slate-200">
                  Virtual Visa (•••• {activeLast4 || cardLast4 || "4214"})
                </span>
              </div>
              <div className="h-[1px] bg-slate-800" />
              <div className="flex justify-between items-center text-slate-300">
                <span>New Card Balance:</span>
                <span className="font-extrabold text-[#DFB338] text-lg">
                  ₮{successData.newCardBalanceUsd} USDT
                </span>
              </div>
            </div>

            {/* Progress / Countdown Bar */}
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 mb-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#DFB338] to-[#B8911E] h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${(countdown / 5) * 100}%` }}
              />
            </div>

            <button
              type="button"
              onClick={handleDone}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_6px_20px_rgba(201,162,39,0.3)] hover:brightness-105 active:scale-[0.99] transition-all text-base text-center cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Go to Dashboard ({countdown}s)</span>
            </button>

            <p className="text-xs text-slate-400 mt-3">
              Automatically reloading and returning to dashboard in{" "}
              <span className="text-[#DFB338] font-bold">{countdown}s</span>...
            </p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Header: fixed/sticky top bar */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-[#0B1528] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#DFB338]/15 border border-[#DFB338]/30 flex items-center justify-center text-[#DFB338] shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                    Top Up Virtual Card
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Instantly transfer from your USDT Wallet with ₮0 fee
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
              {/* Source & Destination Pathway Banner */}
              <div className="w-full bg-[#070e1c] rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between gap-3">
                {/* Source: USDT Wallet */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      From: USDT Wallet
                    </span>
                    <span className="text-sm font-bold text-teal-400 font-mono">
                      ₮{formatMinorUnits(availableUsdtUnits, "USDT", { code: false })} USDT
                    </span>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />

                {/* Target: Virtual Card */}
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      To: Virtual Card
                    </span>
                    <span className="text-sm font-bold text-[#DFB338] font-mono">
                      ₮{activeCardBalance || currentCardBalanceUsd} USDT
                    </span>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-[#DFB338]/15 border border-[#DFB338]/30 flex items-center justify-center text-[#DFB338] shrink-0 font-mono text-xs font-bold">
                    Visa
                  </div>
                </div>
              </div>

              {/* Error Notification */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <label className="font-semibold text-slate-300">Amount to Top Up</label>
                    <span className="text-slate-400">
                      Available:{" "}
                      <strong className="text-white">
                        ₮{formatMinorUnits(availableUsdtUnits, "USDT", { code: false })} USDT
                      </strong>
                    </span>
                  </div>

                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                      ₮
                    </div>
                    <input
                      type="text"
                      value={usdtAmount}
                      onChange={(e) => setUsdtAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isLoading}
                      className="w-full bg-[#070e1c] border border-slate-700/80 rounded-2xl py-3 pl-8 pr-20 text-xl font-mono font-bold text-white focus:outline-none focus:border-[#DFB338] focus:ring-1 focus:ring-[#DFB338] transition-all disabled:opacity-60"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-1 rounded-md">
                      USDT
                    </div>
                  </div>

                  {/* Preset Amount Chips */}
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {[5, 10, 25, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setUsdtAmount(preset.toString())}
                        disabled={isLoading}
                        className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-slate-700/50 cursor-pointer"
                      >
                        +₮{preset}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const major = formatMinorUnits(availableUsdtUnits, "USDT", { code: false });
                        setUsdtAmount(major);
                      }}
                      disabled={isLoading}
                      className="text-xs px-3 py-1.5 rounded-xl bg-[#DFB338]/15 hover:bg-[#DFB338]/25 text-[#DFB338] font-bold transition-colors border border-[#DFB338]/30 cursor-pointer"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Transfer Breakdown Card */}
                <div className="bg-[#070e1c] rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Transfer Fee:</span>
                    <span className="font-semibold text-green-400">₮0.00 (Free)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Reference rate:</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      {usdtPerUsd !== null ? (
                        <>
                          1 USDT = ${usdPerUsdt(usdtPerUsd)} USD
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-1.5 py-0.5 rounded-md">
                            <span className="w-1 h-1 rounded-full bg-green-400" /> LIVE
                          </span>
                        </>
                      ) : (
                        "1 USDT ≈ $1.00 USD (USD-pegged)"
                      )}
                    </span>
                  </div>
                  <div className="h-[1px] bg-slate-800 my-1" />
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-200">
                    <span>Net Card Top-Up:</span>
                    <span className="text-right">
                      <span className="text-green-400 font-bold font-mono text-base">
                        +₮{rawUsdtNumber.toFixed(2)} USDT
                      </span>
                      {usdtPerUsd !== null && rawUsdtNumber > 0 && (
                        <span className="block text-[10px] text-slate-500 font-mono">
                          ≈ ${(rawUsdtNumber / usdtPerUsd).toFixed(2)} USD
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span>Projected Card Balance:</span>
                    <span className="text-[#DFB338] font-bold font-mono">
                      ₮{activeCardBalance || currentCardBalanceUsd} → ₮{projectedCardBalance} USDT
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleFundCard}
                  disabled={
                    isLoading ||
                    rawUsdtNumber <= 0 ||
                    rawUsdtNumber > Number(availableUsdtUnits) / 1000000
                  }
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_8px_25px_rgba(201,162,39,0.35)] hover:brightness-105 active:scale-[0.99] transition-all text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{loadingStage || "Processing..."}</span>
                    </>
                  ) : (
                    <span>Top Up Virtual Card</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
