"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Smartphone, Building2, CreditCard, AlertCircle, ArrowRight, X, ChevronDown } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

type CurrencyOption = {
  code: string;
  name: string;
  flag: string;
  ratePerUsd: number;
  defaultAmount: string;
};

const CURRENCIES: CurrencyOption[] = [
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪", ratePerUsd: 3.67, defaultAmount: "65" },
  { code: "BDT", name: "Bangladeshi Taka", flag: "🇧🇩", ratePerUsd: 117.50, defaultAmount: "2,000" },
  { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳", ratePerUsd: 7.25, defaultAmount: "120" },
  { code: "EUR", name: "Euro", flag: "🇪🇺", ratePerUsd: 0.92, defaultAmount: "20" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", ratePerUsd: 0.78, defaultAmount: "15" },
  { code: "IDR", name: "Indonesian Rupiah", flag: "🇮🇩", ratePerUsd: 16250.00, defaultAmount: "250,000" },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳", ratePerUsd: 83.50, defaultAmount: "1,500" },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵", ratePerUsd: 155.00, defaultAmount: "2,500" },
  { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪", ratePerUsd: 129.50, defaultAmount: "2,000" },
  { code: "KRW", name: "South Korean Won", flag: "🇰🇷", ratePerUsd: 1380.00, defaultAmount: "25,000" },
  { code: "LKR", name: "Sri Lankan Rupee", flag: "🇱🇰", ratePerUsd: 305.00, defaultAmount: "5,000" },
  { code: "MMK", name: "Myanmar Kyat (Burmese)", flag: "🇲🇲", ratePerUsd: 2100.00, defaultAmount: "35,000" },
  { code: "MWK", name: "Malawian Kwacha", flag: "🇲🇼", ratePerUsd: 3333.33, defaultAmount: "50,000" },
  { code: "MYR", name: "Malaysian Ringgit", flag: "🇲🇾", ratePerUsd: 4.70, defaultAmount: "80" },
  { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬", ratePerUsd: 1480.00, defaultAmount: "25,000" },
  { code: "PHP", name: "Philippine Peso", flag: "🇵🇭", ratePerUsd: 58.50, defaultAmount: "1,000" },
  { code: "PKR", name: "Pakistani Rupee", flag: "🇵🇰", ratePerUsd: 278.50, defaultAmount: "5,000" },
  { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬", ratePerUsd: 1.35, defaultAmount: "25" },
  { code: "THB", name: "Thai Baht", flag: "🇹🇭", ratePerUsd: 36.80, defaultAmount: "600" },
  { code: "TWD", name: "New Taiwan Dollar", flag: "🇹🇼", ratePerUsd: 32.40, defaultAmount: "500" },
  { code: "VND", name: "Vietnamese Dong", flag: "🇻🇳", ratePerUsd: 25450.00, defaultAmount: "400,000" },
  { code: "ZAR", name: "South African Rand", flag: "🇿🇦", ratePerUsd: 18.25, defaultAmount: "300" },
].sort((a, b) => a.code.localeCompare(b.code));

export default function DepositPage() {
  const router = useRouter();
  const defaultCurrency = CURRENCIES.find((c) => c.code === "MWK") || CURRENCIES[0];
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyOption>(defaultCurrency);
  const [amount, setAmount] = useState<string>(defaultCurrency.defaultAmount);
  const [selectedMethod, setSelectedMethod] = useState<"mobile" | "bank" | "card">("mobile");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string>("/dashboard");

  // Dynamic calculations based on selected currency
  const rawNumber = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const grossUsd = rawNumber > 0 ? rawNumber / selectedCurrency.ratePerUsd : 0;
  const feeUsd = rawNumber > 0 ? 0.5 : 0;
  const netUsd = Math.max(0, grossUsd - feeUsd);
  const usdtEquivalent = netUsd; // 1 USDT = 1 USD stablecoin peg

  const handleCurrencySelect = (code: string) => {
    const found = CURRENCIES.find((c) => c.code === code);
    if (found) {
      setSelectedCurrency(found);
      setAmount(found.defaultAmount);
    }
  };

  const handleInterceptNavigation = (destination: string) => {
    setPendingDestination(destination);
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    router.push(pendingDestination);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFE] text-stone-900 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Brand-new Background Design: Elegant Topographic Waves & Soft Mesh Ribbons */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-right & bottom-left subtle atmospheric glow */}
        <div className="absolute -top-32 -right-32 w-[550px] h-[550px] bg-blue-500/[0.07] rounded-full blur-[140px]" />
        <div className="absolute -bottom-32 -left-32 w-[550px] h-[550px] bg-[#C9A227]/[0.08] rounded-full blur-[140px]" />

        {/* Fluid Topographic Contour Lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-35"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <path
            d="M-100,120 C320,-40 680,260 1100,80 C1300,0 1450,140 1550,110"
            fill="none"
            stroke="#0066FF"
            strokeWidth="1.2"
            strokeOpacity="0.2"
          />
          <path
            d="M-100,180 C360,20 720,320 1140,140 C1340,60 1480,200 1550,170"
            fill="none"
            stroke="#0066FF"
            strokeWidth="1"
            strokeDasharray="6 6"
            strokeOpacity="0.15"
          />
          <path
            d="M-100,720 C240,840 640,580 1020,760 C1240,860 1440,680 1550,720"
            fill="none"
            stroke="#C9A227"
            strokeWidth="1.2"
            strokeOpacity="0.25"
          />
          <path
            d="M-100,780 C280,900 680,640 1060,820 C1280,920 1470,740 1550,780"
            fill="none"
            stroke="#C9A227"
            strokeWidth="1"
            strokeDasharray="5 5"
            strokeOpacity="0.2"
          />
          <path
            d="M-100,450 C380,320 780,560 1200,420 C1380,360 1480,480 1550,450"
            fill="none"
            stroke="#64748B"
            strokeWidth="0.8"
            strokeOpacity="0.12"
          />
        </svg>

        {/* Floating Subtle Currency Pills */}
        <div className="hidden lg:flex items-center gap-1.5 absolute top-44 left-16 px-3.5 py-1.5 rounded-full bg-white/80 border border-slate-200/80 shadow-sm backdrop-blur-sm text-xs font-semibold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          MWK Currency Gateway
        </div>
        <div className="hidden lg:flex items-center gap-1.5 absolute bottom-44 right-16 px-3.5 py-1.5 rounded-full bg-white/80 border border-slate-200/80 shadow-sm backdrop-blur-sm text-xs font-semibold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          USDT Stablecoin Pegged 1:1
        </div>
      </div>

      {/* Consistent Navigation Header with Intercept Navigation */}
      <AppHeader active="deposit" onInterceptNavigate={handleInterceptNavigation} />

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Page Title & Subtitle */}
        <div className="text-center mb-7">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 mb-2">
            Deposit Funds
          </h1>
          <p className="text-sm sm:text-base text-stone-600 max-w-md mx-auto">
            Seamlessly add funds to your LADTransfer account to get started
          </p>
        </div>

        {/* Deposit Card Container */}
        <div className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-[0_15px_40px_rgba(15,23,42,0.08)] border border-slate-200/90 relative">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            {/* Input: Amount in Selected Currency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-stone-800 uppercase tracking-wide">
                  Amount in {selectedCurrency.code}
                </label>
                <span className="text-xs text-stone-500 font-medium">
                  {selectedCurrency.name}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={selectedCurrency.defaultAmount}
                  className="w-full rounded-2xl border-2 border-stone-300 focus:border-[#C9A227] pl-5 pr-36 py-4 text-xl sm:text-2xl font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-[#C9A227]/15 transition-all shadow-inner"
                />

                {/* Currency Selector Dropdown inside Input */}
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                  <div className="relative">
                    <select
                      value={selectedCurrency.code}
                      onChange={(e) => handleCurrencySelect(e.target.value)}
                      className="appearance-none bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-sm rounded-xl py-2 pl-3 pr-8 border border-stone-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 transition-all shadow-2xs"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-stone-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Conversion Details Box (with Stable Coin Rate Highlight) */}
            <div className="rounded-2xl bg-stone-50 border border-stone-200/80 p-5 space-y-3.5">
              {/* Top Row: Amount Received & Exchange Rate */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Amount Received:
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
                    ${netUsd.toFixed(2)}{" "}
                    <span className="text-sm font-bold text-stone-600">USD</span>
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-0.5">
                  <p className="text-xs font-semibold text-stone-700">
                    1 USD = {selectedCurrency.ratePerUsd.toLocaleString()} {selectedCurrency.code}
                  </p>
                  <p className="text-xs text-stone-500">
                    Total Fee: ${feeUsd.toFixed(2)} USD
                  </p>
                </div>
              </div>

              {/* Requirement 2: Dedicated Stable Coin to USD Conversion Rate Row */}
              <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 flex items-center justify-center text-[7px] text-white font-bold">
                    T
                  </span>
                  <span className="font-semibold text-stone-800">Stablecoin Equivalent:</span>
                  <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    {usdtEquivalent.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-medium text-stone-600 bg-white px-2.5 py-1 rounded-full border border-stone-200/80 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span>Rate: 1 USDT = $1.00 USD (1:1 Peg)</span>
                </div>
              </div>
            </div>

            {/* Payment Methods Section */}
            <div className="space-y-3">
              <label className="text-xs sm:text-sm font-bold text-stone-800 uppercase tracking-wide">
                Payment Methods
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Mobile Money */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod("mobile")}
                  className={`relative rounded-2xl p-4 flex flex-col items-center justify-between min-h-[110px] border-2 transition-all text-center ${
                    selectedMethod === "mobile"
                      ? "border-[#C9A227] bg-[#FDFBF3] shadow-md ring-2 ring-[#C9A227]/20"
                      : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50"
                  }`}
                >
                  <span className="text-xs font-bold text-stone-800">Mobile Money</span>
                  <div className="flex items-center justify-center gap-3 my-2">
                    {/* Airtel Money Badge */}
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-[9px] font-black">
                        a
                      </div>
                      <span className="text-[9px] font-bold text-red-600 tracking-tight">airtel</span>
                    </div>
                    {/* TNM Mpamba Badge */}
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-lg bg-green-600 flex items-center justify-center text-white text-[9px] font-black">
                        M
                      </div>
                      <span className="text-[9px] font-bold text-green-700 tracking-tight">Mpamba</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-stone-500 font-medium">Instant</span>
                </button>

                {/* 2. Bank Transfer */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod("bank")}
                  className={`relative rounded-2xl p-4 flex flex-col items-center justify-between min-h-[110px] border-2 transition-all text-center ${
                    selectedMethod === "bank"
                      ? "border-[#C9A227] bg-[#FDFBF3] shadow-md ring-2 ring-[#C9A227]/20"
                      : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50"
                  }`}
                >
                  <span className="text-xs font-bold text-stone-800">Bank Transfer</span>
                  <div className="flex flex-col items-center justify-center gap-1 my-1">
                    <span className="text-[10px] font-bold text-blue-900 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-blue-700" /> Standard Bank
                    </span>
                    <span className="text-[10px] font-bold text-red-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> NBS Bank
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500 font-medium">1-2 hrs</span>
                </button>

                {/* 3. Credit/Debit Card */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod("card")}
                  className={`relative rounded-2xl p-4 flex flex-col items-center justify-between min-h-[110px] border-2 transition-all text-center ${
                    selectedMethod === "card"
                      ? "border-[#C9A227] bg-[#FDFBF3] shadow-md ring-2 ring-[#C9A227]/20"
                      : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50"
                  }`}
                >
                  <span className="text-xs font-bold text-stone-800">Credit/Debit Card</span>
                  <div className="flex items-center justify-center gap-2 my-2">
                    <span className="text-xs font-extrabold tracking-tighter text-blue-900 italic">
                      VISA
                    </span>
                    <div className="flex">
                      <div className="w-4 h-4 rounded-full bg-[#EB001B]" />
                      <div className="w-4 h-4 rounded-full bg-[#F79E1B] -ml-1.5" />
                    </div>
                  </div>
                  <span className="text-[10px] text-stone-500 font-medium">Card/Online</span>
                </button>
              </div>
            </div>

            {/* Bottom Action Section */}
            <div className="pt-2 flex flex-col items-center gap-3">
              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_6px_20px_rgba(201,162,39,0.3)] hover:shadow-[0_8px_25px_rgba(201,162,39,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all text-base text-center"
              >
                Deposit Funds
              </button>

              <button
                type="button"
                onClick={() => handleInterceptNavigation("/analytics")}
                className="text-xs font-semibold text-stone-500 hover:text-stone-900 hover:underline transition-colors"
              >
                Recent History
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-stone-400">
        <p>© 2026 LADTransfer. All rights reserved.</p>
      </footer>

      {/* Requirement 4: Graceful Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 transform animate-in zoom-in-95 duration-200 relative">
            {/* Close modal X button */}
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Icon & Heading */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C9A227] mb-3.5 shadow-sm">
                <AlertCircle className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-stone-900 mb-2">
                Cancel this deposit?
              </h3>
              <p className="text-sm text-stone-600 mb-6">
                Are you sure you want to leave? Any deposit amount or payment method you selected will not be saved.
              </p>

              {/* Modal Buttons */}
              <div className="w-full flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-sm hover:brightness-105 active:scale-[0.99] transition-all text-sm"
                >
                  Continue Deposit
                </button>
                <button
                  type="button"
                  onClick={confirmCancel}
                  className="w-full py-2.5 px-4 rounded-xl border border-stone-200 hover:bg-stone-100 font-semibold text-stone-600 hover:text-stone-900 transition-colors text-sm"
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
