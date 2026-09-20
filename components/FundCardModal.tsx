"use client";

import { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
} from "lucide-react";
import {
  toMinorUnits,
  fromMinorUnits,
  formatMinorUnits,
  parseMinorUnits,
} from "@/lib/contracts/money";
import type { QuoteResponse, ConversionResponse, FundCardResponse } from "@/lib/contracts";

interface FundCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cardId: string | null;
  cardLast4: string;
  currentCardBalanceUsd: string;
  availableMwkUnits: bigint;
  availableUsdtUnits: bigint;
}

export function FundCardModal({
  isOpen,
  onClose,
  onSuccess,
  cardId,
  cardLast4,
  currentCardBalanceUsd,
  availableMwkUnits,
  availableUsdtUnits,
}: FundCardModalProps) {
  const [sourceType, setSourceType] = useState<"mwk" | "usdt">("mwk");
  const [mwkAmount, setMwkAmount] = useState<string>("50000");
  const [usdtAmount, setUsdtAmount] = useState<string>("10");
  
  // Loading & stage state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success state
  const [successData, setSuccessData] = useState<{
    amountUsd: string;
    newCardBalanceUsd: string;
    source: "MWK" | "USDT";
  } | null>(null);

  // Reset states when opening
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessData(null);
      setIsLoading(false);
      // If user has no MWK but has USDT, default to USDT
      if (availableMwkUnits <= 0n && availableUsdtUnits > 0n) {
        setSourceType("usdt");
      }
    }
  }, [isOpen, availableMwkUnits, availableUsdtUnits]);

  if (!isOpen) return null;

  // Real-time calculations for MWK
  const cleanMwk = mwkAmount.replace(/[^0-9]/g, "");
  const rawMwkNumber = parseInt(cleanMwk, 10) || 0;
  // 1 USDT = 2,000 MWK, fee = 2%
  const grossUsdMwk = rawMwkNumber > 0 ? rawMwkNumber / 2000 : 0;
  const mwkFeeUsd = grossUsdMwk * 0.02;
  const netUsdMwk = Math.max(0, grossUsdMwk - mwkFeeUsd);

  // Real-time calculations for USDT
  const cleanUsdt = usdtAmount.replace(/[^0-9.]/g, "");
  const rawUsdtNumber = parseFloat(cleanUsdt) || 0;
  const netUsdFromUsdt = rawUsdtNumber;

  const currentCardNum = parseFloat(currentCardBalanceUsd) || 0;
  const projectedCardBalance =
    sourceType === "mwk"
      ? (currentCardNum + netUsdMwk).toFixed(2)
      : (currentCardNum + netUsdFromUsdt).toFixed(2);

  const handleFundCard = async () => {
    setErrorMsg(null);
    if (!cardId) {
      setErrorMsg("No active virtual card found to fund. Please reload the dashboard.");
      return;
    }

    setIsLoading(true);

    try {
      if (sourceType === "mwk") {
        if (rawMwkNumber <= 0) {
          throw new Error("Please enter a valid amount in MWK.");
        }

        const inputUnits = BigInt(rawMwkNumber) * 100n; // MWK exponent 2 (tambala)
        if (inputUnits > availableMwkUnits) {
          throw new Error("Amount exceeds your available MWK wallet balance.");
        }

        // Stage 1: Get live Quote
        setLoadingStage("Getting guaranteed exchange quote...");
        const quoteRes = await fetch("/api/v1/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_asset: "MWK",
            destination_asset: "USDT",
            source_units: inputUnits.toString(),
          }),
        });

        if (!quoteRes.ok) {
          const errData = await quoteRes.json().catch(() => ({}));
          throw new Error(errData?.error?.message || "Failed to create quote.");
        }

        const quoteData = (await quoteRes.json()) as QuoteResponse;

        // Stage 2: Execute Conversion MWK -> USDT
        setLoadingStage("Converting MWK to USDT...");
        const convRes = await fetch("/api/v1/conversions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            quote_id: quoteData.quote_id,
          }),
        });

        if (!convRes.ok) {
          const errData = await convRes.json().catch(() => ({}));
          throw new Error(errData?.error?.message || "Failed to complete conversion.");
        }

        const convData = (await convRes.json()) as ConversionResponse;

        // Stage 3: Fund Virtual Card with converted USDT
        setLoadingStage("Funding virtual card...");
        const fundRes = await fetch(`/api/v1/cards/${cardId}/fund`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            amount_units: convData.destination.amount_units,
          }),
        });

        if (!fundRes.ok) {
          const errData = await fundRes.json().catch(() => ({}));
          throw new Error(
            errData?.error?.message ||
              "Converted USDT to your wallet, but funding the card encountered an error. You can fund directly from your USDT wallet."
          );
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
          source: "MWK",
        });
        onSuccess();
      } else {
        // Direct USDT Funding
        if (rawUsdtNumber <= 0) {
          throw new Error("Please enter a valid USDT amount.");
        }

        const usdtUnits = toMinorUnits(cleanUsdt, "USDT");
        if (usdtUnits > availableUsdtUnits) {
          throw new Error("Amount exceeds your available USDT wallet balance.");
        }

        setLoadingStage("Allocating USDT to virtual card...");
        const fundRes = await fetch(`/api/v1/cards/${cardId}/fund`, {
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
          throw new Error(errData?.error?.message || "Failed to fund virtual card.");
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
          source: "USDT",
        });
        onSuccess();
      }
    } catch (err: any) {
      console.error("Card funding error:", err);
      setErrorMsg(err.message || "An unexpected error occurred while funding your card.");
    } finally {
      setIsLoading(false);
      setLoadingStage("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0B1528] rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.5)] border border-slate-700/60 transform animate-in zoom-in-95 duration-200 relative text-white">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Content / Success State */}
        {successData ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-3xl bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 mb-4 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-2xl font-extrabold text-white mb-1">Card Funded!</h3>
            <p className="text-sm text-slate-400 mb-6">
              Your virtual card is loaded and ready for online spending.
            </p>

            {/* Summary Box */}
            <div className="w-full bg-[#070e1c] rounded-2xl p-4 border border-slate-800 mb-6 space-y-3 text-sm">
              <div className="flex justify-between items-center text-slate-400">
                <span>Funded Amount:</span>
                <span className="font-bold text-green-400 text-base">
                  +${successData.amountUsd} USD
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Source:</span>
                <span className="font-medium text-slate-200">
                  {successData.source === "MWK" ? "MWK Wallet (Converted)" : "USDT Wallet"}
                </span>
              </div>
              <div className="h-[1px] bg-slate-800" />
              <div className="flex justify-between items-center text-slate-300">
                <span>New Card Balance:</span>
                <span className="font-extrabold text-[#DFB338] text-lg">
                  ${successData.newCardBalanceUsd} USD
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_6px_20px_rgba(201,162,39,0.3)] hover:brightness-105 active:scale-[0.99] transition-all text-base text-center"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-[#DFB338]/15 border border-[#DFB338]/30 flex items-center justify-center text-[#DFB338]">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Fund Virtual Card
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Add spendable USD balance to your card
                </p>
              </div>
            </div>

            {/* Target Card Banner */}
            <div className="w-full bg-[#070e1c] rounded-2xl p-3.5 border border-slate-800/80 flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="px-2 py-1 rounded bg-slate-800 text-[11px] font-mono font-bold text-[#DFB338]">
                  •••• {cardLast4 || "4214"}
                </div>
                <span className="text-xs text-slate-400 font-medium">Virtual Visa</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Current Card Spend
                </span>
                <span className="text-sm font-bold text-[#DFB338]">
                  ${currentCardBalanceUsd} USD
                </span>
              </div>
            </div>

            {/* Source Selection Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#070e1c] rounded-2xl border border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => {
                  setSourceType("mwk");
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  sourceType === "mwk"
                    ? "bg-gradient-to-r from-[#DFB338] to-[#B8911E] text-stone-900 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🇲🇼</span>
                <span>Convert MWK</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceType("usdt");
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  sourceType === "usdt"
                    ? "bg-gradient-to-r from-[#DFB338] to-[#B8911E] text-stone-900 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Direct USDT</span>
              </button>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form Fields: Convert MWK */}
            {sourceType === "mwk" && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <label className="font-semibold text-slate-300">Amount to Convert (MWK)</label>
                    <span className="text-slate-400">
                      Available:{" "}
                      <strong className="text-white">
                        {formatMinorUnits(availableMwkUnits, "MWK", { code: false })} MWK
                      </strong>
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={mwkAmount}
                      onChange={(e) => setMwkAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="50000"
                      disabled={isLoading}
                      className="w-full bg-[#070e1c] border border-slate-700/80 rounded-2xl py-3 px-4 text-lg font-mono font-bold text-white focus:outline-none focus:border-[#DFB338] focus:ring-1 focus:ring-[#DFB338] transition-all disabled:opacity-60"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#DFB338] bg-[#DFB338]/10 px-2 py-1 rounded-md">
                      MWK
                    </div>
                  </div>

                  {/* Preset Amount Chips */}
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {[10000, 25000, 50000, 100000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMwkAmount(preset.toString())}
                        disabled={isLoading}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-slate-700/50"
                      >
                        +{preset.toLocaleString()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const major = fromMinorUnits(availableMwkUnits, "MWK").split(".")[0];
                        setMwkAmount(major || "0");
                      }}
                      disabled={isLoading}
                      className="text-xs px-2.5 py-1 rounded-lg bg-[#DFB338]/15 hover:bg-[#DFB338]/25 text-[#DFB338] font-bold transition-colors border border-[#DFB338]/30"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Live Quote Summary Card */}
                <div className="bg-[#070e1c] rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Guaranteed Rate:</span>
                    <span className="font-semibold text-slate-200">1 USDT = 2,000.00 MWK</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Conversion Fee (2%):</span>
                    <span className="font-semibold text-slate-200">
                      ${mwkFeeUsd.toFixed(2)} USD ({(rawMwkNumber * 0.02).toLocaleString()} MWK)
                    </span>
                  </div>
                  <div className="h-[1px] bg-slate-800 my-1" />
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-200">
                    <span>Net Card Deposit:</span>
                    <span className="text-green-400 font-bold font-mono text-base">
                      +${netUsdMwk.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span>Projected Card Balance:</span>
                    <span className="text-[#DFB338] font-bold">
                      ${currentCardBalanceUsd} → ${projectedCardBalance} USD
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Form Fields: Direct USDT */}
            {sourceType === "usdt" && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <label className="font-semibold text-slate-300">Amount to Transfer (USDT)</label>
                    <span className="text-slate-400">
                      Available:{" "}
                      <strong className="text-white">
                        ${formatMinorUnits(availableUsdtUnits, "USDT", { code: false })} USDT
                      </strong>
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={usdtAmount}
                      onChange={(e) => setUsdtAmount(e.target.value)}
                      placeholder="10.00"
                      disabled={isLoading}
                      className="w-full bg-[#070e1c] border border-slate-700/80 rounded-2xl py-3 px-4 text-lg font-mono font-bold text-white focus:outline-none focus:border-[#DFB338] focus:ring-1 focus:ring-[#DFB338] transition-all disabled:opacity-60"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#DFB338] bg-[#DFB338]/10 px-2 py-1 rounded-md">
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
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-slate-700/50"
                      >
                        +${preset}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const major = formatMinorUnits(availableUsdtUnits, "USDT", { code: false });
                        setUsdtAmount(major);
                      }}
                      disabled={isLoading}
                      className="text-xs px-2.5 py-1 rounded-lg bg-[#DFB338]/15 hover:bg-[#DFB338]/25 text-[#DFB338] font-bold transition-colors border border-[#DFB338]/30"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Transfer Summary Card */}
                <div className="bg-[#070e1c] rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Internal Transfer Fee:</span>
                    <span className="font-semibold text-green-400">$0.00 (Free)</span>
                  </div>
                  <div className="h-[1px] bg-slate-800 my-1" />
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-200">
                    <span>Net Card Deposit:</span>
                    <span className="text-green-400 font-bold font-mono text-base">
                      +${netUsdFromUsdt.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span>Projected Card Balance:</span>
                    <span className="text-[#DFB338] font-bold">
                      ${currentCardBalanceUsd} → ${projectedCardBalance} USD
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-5">
              <button
                type="button"
                onClick={handleFundCard}
                disabled={
                  isLoading ||
                  (sourceType === "mwk" && (rawMwkNumber <= 0 || BigInt(rawMwkNumber) * 100n > availableMwkUnits)) ||
                  (sourceType === "usdt" && (rawUsdtNumber <= 0 || rawUsdtNumber > Number(availableUsdtUnits) / 1000000))
                }
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_8px_25px_rgba(201,162,39,0.35)] hover:brightness-105 active:scale-[0.99] transition-all text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{loadingStage || "Processing..."}</span>
                  </>
                ) : (
                  <>
                    
                    <span>
                      {sourceType === "mwk" ? "Convert & Fund Card" : "Transfer to Card"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
