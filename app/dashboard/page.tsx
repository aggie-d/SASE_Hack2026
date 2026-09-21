"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BarChart3, ArrowUpRight, Eye, EyeOff, CreditCard, Plus, ShoppingBag } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { formatMinorUnits, parseMinorUnits } from "@/lib/contracts/money";
import type { CardResponse, MeResponse, WalletsResponse, CardsResponse } from "@/lib/contracts";
import { FundCardModal } from "@/components/FundCardModal";

export default function DashboardPage() {
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [displayName, setDisplayName] = useState("Loading...");
  const [rawUsdtBalance, setRawUsdtBalance] = useState("0.00");
  const [rawCardFundingBalance, setRawCardFundingBalance] = useState("0.00");
  const [fullCardNumber, setFullCardNumber] = useState("XXXX XXXX XXXX XXXX");
  const [cardLast4, setCardLast4] = useState<string>("XXXX");
  const [cardCvv, setCardCvv] = useState<string>("321");
  const [cardExp, setCardExp] = useState<string>("05/27");

  // Fund Modal States
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [availableUsdtUnits, setAvailableUsdtUnits] = useState<bigint>(0n);

  const loadDashboardData = useCallback(async () => {
    try {
      // Fetch User Profile
      const meRes = await fetch("/api/v1/me");
      let userDisplayName = "User";
      if (meRes.ok) {
        const meData = (await meRes.json()) as MeResponse;
        userDisplayName = meData.display_name;
        setDisplayName(userDisplayName);

        if (meData.card_details) {
          setFullCardNumber(meData.card_details.card_number);
          setCardLast4(meData.card_details.last4);
          setCardCvv(meData.card_details.cvv);
          setCardExp(meData.card_details.exp || "05/27");
        }
      }

      // Fetch Wallets (USDT Wallet and Card Funding)
      const walletsRes = await fetch("/api/v1/wallets");
      if (walletsRes.ok) {
        const walletsData = (await walletsRes.json()) as WalletsResponse;
        const usdtWallet = walletsData.wallets.find((w) => w.purpose === "usdt_wallet");
        const cardWallet = walletsData.wallets.find((w) => w.purpose === "card_funding");

        const totalUsdtUnits = usdtWallet ? parseMinorUnits(usdtWallet.available_units) : 0n;
        const totalCardFundingUnits = cardWallet ? parseMinorUnits(cardWallet.available_units) : 0n;

        setAvailableUsdtUnits(totalUsdtUnits);
        setRawUsdtBalance(formatMinorUnits(totalUsdtUnits, "USDT", { code: false }));
        setRawCardFundingBalance(formatMinorUnits(totalCardFundingUnits, "USDT", { code: false }));
      }

      // Fetch Cards
      const cardsRes = await fetch("/api/v1/cards");
      if (cardsRes.ok) {
        const cardsData = (await cardsRes.json()) as CardsResponse;
        if (cardsData.cards && cardsData.cards.length > 0) {
          const card = cardsData.cards[0];
          setActiveCardId(card.card_id);
          setCardLast4(card.last4);
          setFullCardNumber((prev) => {
            const parts = prev.split(" ");
            if (parts.length === 4) {
              parts[3] = card.last4;
              return parts.join(" ");
            }
            return prev;
          });
        } else {
          // Auto-create virtual card if user doesn't have one
          const createRes = await fetch("/api/v1/cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardholder_name: userDisplayName }),
          });
          if (createRes.ok) {
            const newCard = (await createRes.json()) as CardResponse;
            setActiveCardId(newCard.card_id);
            setCardLast4(newCard.last4);
            setFullCardNumber((prev) => {
              const parts = prev.split(" ");
              if (parts.length === 4) {
                parts[3] = newCard.last4;
                return parts.join(" ");
              }
              return prev;
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-stone-900 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background: Animated Dot-Matrix Wave — 24 narrow strips for a smooth sine-wave sweep */}
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: `${(i * 100) / 24}%`,
            width: `${100 / 24}%`,
            backgroundImage: "radial-gradient(#475569 2px, transparent 2px)",
            backgroundSize: "26px 26px",
            backgroundAttachment: "fixed",
            opacity: 0.5,
            animation: `dot-wave 0.8s ease-in-out ${(i * 0.035).toFixed(3)}s`,
          }}
        />
      ))}

      {/* Soft Ambient Colorful Atmosphere */}
      <div
        className="absolute top-0 left-1/4 w-[500px] h-[350px] bg-blue-400/10 rounded-full blur-[130px] pointer-events-none"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.1s both" }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[500px] h-[350px] bg-[#C9A227]/10 rounded-full blur-[140px] pointer-events-none"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.35s both" }}
      />

      {/* Subtle Circuit Tech Lines in Background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.15s both" }}
      >
        <path d="M0,150 L200,150 L260,210 L500,210" fill="none" stroke="#0066FF" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="260" cy="210" r="3.5" fill="#0066FF" />
        <path d="M1000,600 L1200,600 L1260,540 L1600,540" fill="none" stroke="#C9A227" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="1260" cy="540" r="3.5" fill="#C9A227" />
        <circle cx="200" cy="150" r="2.5" fill="#0066FF" />
      </svg>

      {/* Floating Light Wisps — appear after the wave animation completes */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "18%",
          left: "12%",
          width: "80px",
          height: "80px",
          background: "rgba(96, 165, 250, 0.35)",
          filter: "blur(40px)",
          animation: "wisp-drift-1 12s ease-in-out 1.5s infinite",
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "65%",
          right: "10%",
          width: "100px",
          height: "100px",
          background: "rgba(201, 162, 39, 0.3)",
          filter: "blur(45px)",
          animation: "wisp-drift-2 15s ease-in-out 2s infinite",
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "40%",
          left: "55%",
          width: "60px",
          height: "60px",
          background: "rgba(96, 165, 250, 0.25)",
          filter: "blur(35px)",
          animation: "wisp-drift-3 10s ease-in-out 1.8s infinite",
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "75%",
          left: "30%",
          width: "70px",
          height: "70px",
          background: "rgba(201, 162, 39, 0.25)",
          filter: "blur(40px)",
          animation: "wisp-drift-4 13s ease-in-out 2.2s infinite",
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "25%",
          right: "25%",
          width: "90px",
          height: "90px",
          background: "rgba(96, 165, 250, 0.2)",
          filter: "blur(50px)",
          animation: "wisp-drift-1 14s ease-in-out 2.5s infinite",
        }}
      />

      {/* Consistent Navigation Header */}
      <div style={{ animation: "wave-lift 0.9s ease-in-out 0.08s both" }}>
        <AppHeader active="dashboard" />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Virtual Card Container — scales nicely on large screens */}
        <div
          className="w-full max-w-[480px] sm:max-w-[540px] md:max-w-[600px] lg:max-w-[720px] xl:max-w-[800px] perspective-1000 mb-5 sm:mb-6"
          style={{ animation: "wave-lift 0.9s ease-in-out 0.22s both" }}
        >
          <div 
            className="w-full aspect-[1.586/1] rounded-3xl lg:rounded-[2rem] p-6 sm:p-7 lg:p-10 shadow-[0_20px_50px_rgba(11,21,40,0.35)] lg:shadow-[0_30px_60px_rgba(11,21,40,0.4)] border border-slate-700/50 flex flex-col justify-between relative overflow-hidden text-white group transition-all duration-300 hover:shadow-[0_25px_60px_rgba(11,21,40,0.45)] hover:-translate-y-1"
            style={{
              background: "linear-gradient(135deg, #091326 0%, #0c1833 45%, #070e1c 100%)"
            }}
          >
            {/* Elegant Background Curved Mesh Accents from Mockup */}
            <div className="absolute inset-0 pointer-events-none opacity-25">
              <svg className="w-full h-full" viewBox="0 0 480 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <circle cx="430" cy="180" r="140" stroke="#DFB338" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                <circle cx="430" cy="180" r="180" stroke="#DFB338" strokeWidth="1" opacity="0.4" />
                <path d="M-50,220 C100,160 220,280 360,180 C420,130 460,90 520,70" stroke="#DFB338" strokeWidth="1" opacity="0.5" />
                <path d="M-50,250 C120,180 240,300 390,200 C450,150 490,110 550,90" stroke="#DFB338" strokeWidth="1" strokeDasharray="2 2" opacity="0.35" />
              </svg>
            </div>

            {/* Subtle Top Glow */}
            <div className="absolute top-0 right-0 w-52 h-52 lg:w-72 lg:h-72 bg-[#C9A227]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Card Header: Brand + Contactless Icon / Quick Fund */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-1 font-bold text-lg sm:text-xl lg:text-3xl tracking-tight select-none">
                <span className="text-[#C9A227] text-xl sm:text-2xl lg:text-4xl">LT</span>
                <span className="text-[#C9A227] ml-0.5">LAD</span>
                <span className="text-white">Transfer</span>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFundModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-full bg-[#DFB338]/20 hover:bg-[#DFB338]/30 border border-[#DFB338]/40 text-[#DFB338] text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>Fund Card</span>
                </button>

                {/* Contactless Waves Icon */}
                <div className="text-slate-300/80">
                  <svg className="w-6 h-6 lg:w-9 lg:h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                    <path d="M12 19a8.5 8.5 0 0 0 0-14" />
                    <path d="M15.5 21.5a12 12 0 0 0 0-19" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card Middle: EMV Chip + Balance */}
            <div className="relative z-10 flex items-center justify-between my-auto pt-2 lg:pt-4">
              {/* Gold EMV Chip */}
              <div className="w-12 h-9 lg:w-16 lg:h-12 xl:w-20 xl:h-14 rounded-lg lg:rounded-xl bg-gradient-to-br from-[#F5D77F] via-[#DFB338] to-[#9E7A1B] p-0.5 lg:p-1 shadow-md flex flex-col justify-between relative overflow-hidden border border-yellow-200/50">
                <div className="w-full h-full border border-black/20 rounded flex flex-col justify-around py-0.5 lg:py-1">
                  <div className="w-full h-[1px] lg:h-[1.5px] bg-black/30" />
                  <div className="w-full h-[1px] lg:h-[1.5px] bg-black/30" />
                  <div className="w-full h-[1px] lg:h-[1.5px] bg-black/30" />
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 lg:w-5 h-full border-x border-black/30" />
              </div>

              {/* Current Balance - strictly card funds */}
              <div className="text-right select-none">
                <p className="text-[10px] sm:text-xs lg:text-sm xl:text-base font-semibold uppercase tracking-wider text-[#DFB338]">
                  Current Balance
                </p>
                <p className="text-2xl sm:text-3xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight text-[#DFB338]">
                  {rawCardFundingBalance}{" "}
                  <span className="text-sm sm:text-base lg:text-2xl xl:text-3xl font-bold text-white/90">
                    USDT
                  </span>
                </p>
              </div>
            </div>

            {/* Card Number */}
            <div className="relative z-10 py-1 lg:py-3 flex items-center justify-between mt-2 lg:mt-6">
              <span className="font-mono text-lg sm:text-xl lg:text-3xl xl:text-4xl font-bold tracking-[0.22em] lg:tracking-[0.25em] text-[#DFB338] select-none">
                {showCardNumber
                  ? fullCardNumber
                  : `XXXX XXXX XXXX ${cardLast4}`}
              </span>
              <button
                type="button"
                onClick={() => setShowCardNumber(!showCardNumber)}
                className="text-xs lg:text-base text-slate-400 hover:text-[#DFB338] transition-colors p-1 lg:p-2"
                aria-label="Toggle card number visibility"
              >
                {showCardNumber ? <EyeOff className="w-4 h-4 lg:w-6 lg:h-6" /> : <Eye className="w-4 h-4 lg:w-6 lg:h-6" />}
              </button>
            </div>

            {/* Card Footer: Holder Info + Expiry + CVV */}
            <div className="relative z-10 flex items-end justify-between text-xs lg:text-base pt-1 lg:pt-2">
              <div>
                <p className="text-[9px] lg:text-xs xl:text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Premium Platinum
                </p>
                <p className="font-bold tracking-wider uppercase text-white sm:text-sm lg:text-xl xl:text-2xl">
                  {displayName}
                </p>
              </div>

              <div className="flex items-center gap-5 lg:gap-8 text-right">
                <div>
                  <p className="text-[9px] lg:text-xs xl:text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    EXP
                  </p>
                  <p className="font-mono font-bold text-white sm:text-sm lg:text-xl xl:text-2xl">
                    {cardExp}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] lg:text-xs xl:text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    CVV
                  </p>
                  <p className="font-mono font-bold text-white sm:text-sm lg:text-xl xl:text-2xl">
                    {cardCvv}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Balances Breakdown */}
        <div 
          className="w-full max-w-[480px] sm:max-w-[540px] md:max-w-[600px] lg:max-w-[720px] xl:max-w-[800px] grid grid-cols-2 gap-3 sm:gap-5 mb-5 sm:mb-6"
          style={{ animation: "wave-lift 0.9s ease-in-out 0.32s both" }}
        >
          <div className="bg-[#0B1528] rounded-2xl p-4 sm:p-5 border border-slate-800 text-center shadow-md">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400">
              USDT Wallet
            </p>
            <p className="text-sm sm:text-lg lg:text-xl font-bold text-teal-400 mt-1 truncate">
              ${rawUsdtBalance} <span className="text-xs text-slate-400 font-medium">USDT</span>
            </p>
          </div>
          <div
            onClick={() => setIsFundModalOpen(true)}
            className="bg-[#0B1528] rounded-2xl p-4 sm:p-5 border border-slate-800 text-center shadow-md cursor-pointer hover:border-[#DFB338]/60 hover:shadow-[0_0_20px_rgba(223,179,56,0.15)] transition-all group"
          >
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400 group-hover:text-[#DFB338] transition-colors">
                Card Funds
              </p>
              <span className="text-[9px] sm:text-[10px] bg-[#DFB338]/20 text-[#DFB338] font-bold px-2 py-0.5 rounded-full">
                + Top Up
              </span>
            </div>
            <p className="text-sm sm:text-lg lg:text-xl font-bold text-[#DFB338] mt-1 truncate">
              ${rawCardFundingBalance} <span className="text-xs text-slate-400 font-medium">USDT</span>
            </p>
          </div>
        </div>

        {/* Action Buttons: Fund Card, Deposit & Analytics */}
        <div
          className="w-full max-w-[480px] sm:max-w-[540px] md:max-w-[600px] lg:max-w-[720px] xl:max-w-[800px] grid grid-cols-3 gap-2.5 sm:gap-4 lg:gap-5"
          style={{ animation: "wave-lift 0.9s ease-in-out 0.36s both" }}
        >
          {/* Fund Card CTA */}
          <button
            type="button"
            onClick={() => setIsFundModalOpen(true)}
            className="flex items-center justify-center gap-1.5 sm:gap-2.5 py-3.5 sm:py-4 px-2 sm:px-4 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_8px_20px_rgba(201,162,39,0.25)] hover:shadow-[0_12px_28px_rgba(201,162,39,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all text-xs sm:text-base lg:text-lg cursor-pointer"
          >
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            <span>Fund Card</span>
          </button>

          {/* Deposit CTA */}
          <Link
            href="/deposit"
            className="flex items-center justify-center gap-1.5 sm:gap-2.5 py-3.5 sm:py-4 px-2 sm:px-4 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_8px_20px_rgba(201,162,39,0.25)] hover:shadow-[0_12px_28px_rgba(201,162,39,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all text-xs sm:text-base lg:text-lg text-center"
          >
            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            <span>Deposit</span>
          </Link>

          {/* Analytics CTA */}
          <Link
            href="/analytics"
            className="flex items-center justify-center gap-1.5 sm:gap-2.5 py-3.5 sm:py-4 px-2 sm:px-4 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_8px_20px_rgba(201,162,39,0.25)] hover:shadow-[0_12px_28px_rgba(201,162,39,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all text-xs sm:text-base lg:text-lg text-center"
          >
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            <span>Analytics</span>
          </Link>
        </div>

        {/* Demo: spend the card at a simulated merchant */}
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <Link
            href="/checkout"
            className="mt-5 sm:mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-slate-200 shadow-sm text-xs sm:text-sm font-semibold text-stone-600 hover:text-stone-900 hover:border-stone-300 transition-colors"
          >
            <ShoppingBag className="w-4 h-4 text-[#C9A227]" />
            <span>Spend your card at a demo merchant</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 py-5 text-center text-xs text-stone-500"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.45s both" }}
      >
        <p>© 2026 LADTransfer. All rights reserved.</p>
      </footer>

      {/* Fund Card Modal */}
      <FundCardModal
        isOpen={isFundModalOpen}
        onClose={() => setIsFundModalOpen(false)}
        onSuccess={() => loadDashboardData()}
        cardId={activeCardId}
        cardLast4={cardLast4}
        currentCardBalanceUsd={rawCardFundingBalance}
        availableUsdtUnits={availableUsdtUnits}
      />
    </div>
  );
}
