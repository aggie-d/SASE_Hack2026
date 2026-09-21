"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  AlertCircle, 
  X, 
  ChevronDown, 
  CheckCircle2, 
  Loader2 
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import type { RatesResponse } from "@/lib/contracts";
import { formatAmountInput, normalizeAmountInput } from "@/lib/format-amount";

type CurrencyOption = {
  code: string;
  name: string;
  flag: string;
  /** Offline fallback only — the live rate from GET /api/v1/rates wins when available. */
  ratePerUsd: number;
};

type RatesState =
  | { status: "loading" }
  | { status: "live"; data: RatesResponse }
  | { status: "offline" };

/** Deposit fee as a percentage. Server enforces the same (DEPOSIT_FEE_BPS = 100). */
const DEPOSIT_FEE_PERCENT = 1;

/** "1 USD = X CODE" with enough precision to be meaningful for both 0.78 and 25,450. */
function formatRate(rate: number): string {
  const decimals = rate >= 100 ? 2 : rate >= 10 ? 3 : 4;
  return rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: decimals });
}

const CURRENCIES: CurrencyOption[] = [
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪", ratePerUsd: 3.67 },
  { code: "BDT", name: "Bangladeshi Taka", flag: "🇧🇩", ratePerUsd: 117.50 },
  { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳", ratePerUsd: 7.25 },
  { code: "EUR", name: "Euro", flag: "🇪🇺", ratePerUsd: 0.92 },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", ratePerUsd: 0.78 },
  { code: "IDR", name: "Indonesian Rupiah", flag: "🇮🇩", ratePerUsd: 16250.00 },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳", ratePerUsd: 83.50 },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵", ratePerUsd: 155.00 },
  { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪", ratePerUsd: 129.50 },
  { code: "KRW", name: "South Korean Won", flag: "🇰🇷", ratePerUsd: 1380.00 },
  { code: "LKR", name: "Sri Lankan Rupee", flag: "🇱🇰", ratePerUsd: 305.00 },
  { code: "MMK", name: "Myanmar Kyat (Burmese)", flag: "🇲🇲", ratePerUsd: 2100.00 },
  { code: "MWK", name: "Malawian Kwacha", flag: "🇲🇼", ratePerUsd: 3333.33 },
  { code: "MYR", name: "Malaysian Ringgit", flag: "🇲🇾", ratePerUsd: 4.70 },
  { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬", ratePerUsd: 1480.00 },
  { code: "PHP", name: "Philippine Peso", flag: "🇵🇭", ratePerUsd: 58.50 },
  { code: "PKR", name: "Pakistani Rupee", flag: "🇵🇰", ratePerUsd: 278.50 },
  { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬", ratePerUsd: 1.35 },
  { code: "THB", name: "Thai Baht", flag: "🇹🇭", ratePerUsd: 36.80 },
  { code: "TWD", name: "New Taiwan Dollar", flag: "🇹🇼", ratePerUsd: 32.40 },
  { code: "VND", name: "Vietnamese Dong", flag: "🇻🇳", ratePerUsd: 25450.00 },
  { code: "ZAR", name: "South African Rand", flag: "🇿🇦", ratePerUsd: 18.25 },
].sort((a, b) => a.code.localeCompare(b.code));

export default function DepositPage() {
  const router = useRouter();
  const defaultCurrency = CURRENCIES.find((c) => c.code === "MWK") || CURRENCIES[0];
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyOption>(defaultCurrency);
  const [amount, setAmount] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<"mobile" | "bank">("mobile");
  
  // Action & Feedback state
  const [isDepositing, setIsDepositing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    amount: string;
    netUsd: string;
    currency: string;
    sourceName: string;
    /** Rate the server applied, e.g. "1 USD = 1,736.97 MWK · 1 USD = 1.0005 USDT". */
    appliedRate: string | null;
    /** "jsdelivr@2026-09-20" | "pinned@pinned" | "mock" */
    rateSource: string | null;
  } | null>(null);

  // Cancel Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string>("/dashboard");

  // Live FX rates (fawazahmed0/exchange-api via our /api/v1/rates). Falls back
  // to the static table above if the fetch fails, and says so in the UI.
  const [rates, setRates] = useState<RatesState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const symbols = [...CURRENCIES.map((c) => c.code), "USDT"].join(",");
    fetch(`/api/v1/rates?symbols=${symbols}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`rates ${res.status}`);
        return (await res.json()) as RatesResponse;
      })
      .then((data) => {
        if (!cancelled) setRates({ status: "live", data });
      })
      .catch((e) => {
        console.error("Live rates unavailable, using offline table", e);
        if (!cancelled) setRates({ status: "offline" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rates in use: live if we have them, else the offline table.
  const liveRates = rates.status === "live" ? rates.data.rates : null;
  const ratePerUsd = liveRates?.[selectedCurrency.code] ?? selectedCurrency.ratePerUsd;
  const usdtPerUsd = liveRates?.USDT ?? 1; // USDT is USD-pegged; live value is ≈1.000x
  const rateIsLive = liveRates !== null && selectedCurrency.code in liveRates;

  // Dynamic calculations based on selected currency
  const rawNumber = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const grossUsd = rawNumber > 0 ? rawNumber / ratePerUsd : 0;
  // 1% fee, floored to the cent — mirrors DEPOSIT_FEE_BPS on the server.
  const feeUsd = Math.floor(grossUsd * DEPOSIT_FEE_PERCENT) / 100;
  const netUsd = Math.max(0, grossUsd - feeUsd);
  const usdtEquivalent = netUsd * usdtPerUsd;
  const isMwk = selectedCurrency.code === "MWK";

  const handleCurrencySelect = (code: string) => {
    const found = CURRENCIES.find((c) => c.code === code);
    if (found) {
      setSelectedCurrency(found);
      setAmount("");
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

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (rawNumber <= 0) {
      setErrorMsg("Please enter a positive deposit amount.");
      return;
    }

    setIsDepositing(true);

    try {
      const res = await fetch("/api/v1/deposits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: selectedMethod,
          amount: rawNumber.toString(),
          currency: selectedCurrency.code,
          net_usd: netUsd,
          net_usdt: usdtEquivalent,
          rate_per_usd: ratePerUsd,
          rate_source: rates.status === "live" ? `${rates.data.source}@${rates.data.date}` : "offline",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Failed to process deposit.");
      }

      const data = await res.json();
      // Show what the SERVER credited and the rate it applied — not our preview.
      // If the market moved between page load and submit, this is the truth.
      const applied = data.applied_rate as
        | { currency: string; per_usd: string; usdt_per_usd: string; source: string }
        | undefined;
      setSuccessData({
        amount: typeof data.amount === "string" ? data.amount : `${usdtEquivalent.toFixed(2)} USDT`,
        netUsd: netUsd.toFixed(2),
        currency: selectedCurrency.code,
        appliedRate: applied
          ? applied.currency === "USD"
            ? `1 USD = ${Number(applied.usdt_per_usd).toFixed(4)} USDT`
            : `1 USD = ${formatRate(Number(applied.per_usd))} ${applied.currency} · 1 USD = ${Number(applied.usdt_per_usd).toFixed(4)} USDT`
          : null,
        rateSource: applied?.source ?? null,
        sourceName: data.payment_method?.title
          ? `${data.payment_method.title} (${data.payment_method.subtitle})`
          : selectedMethod === "mobile"
            ? "Mobile Money"
            : "Bank Transfer",
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process deposit. Please try again.");
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFE] text-stone-900 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Brand Background Design: Elegant Topographic Waves & Soft Mesh Ribbons */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Atmosphere glow */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-blue-500/[0.08] rounded-full blur-[130px]" />
        <div className="absolute -bottom-32 -left-32 w-[600px] h-[600px] bg-[#C9A227]/[0.14] rounded-full blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[500px] bg-blue-500/[0.09] rounded-full blur-[140px]" />

        {/* Fluid Topographic Wispy Contour Lines — prominent and layered */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="blueWisp1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0066FF" stopOpacity="0.25" />
              <stop offset="35%" stopColor="#0066FF" stopOpacity="0.75" />
              <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="blueWisp2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="goldWisp1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9A227" stopOpacity="0.25" />
              <stop offset="30%" stopColor="#DFB338" stopOpacity="0.8" />
              <stop offset="65%" stopColor="#F5D77F" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#C9A227" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="goldWisp2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B8911E" stopOpacity="0.2" />
              <stop offset="45%" stopColor="#DFB338" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#9E7A1B" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Blue Wave Flow — Layered Contours Positioned Directly Behind the Main Deposit Card */}
          <path
            d="M-100,310 C280,160 640,470 1060,290 C1280,210 1430,350 1550,320"
            fill="none"
            stroke="url(#blueWisp1)"
            strokeWidth="2.4"
          />
          <path
            d="M-100,355 C310,205 670,510 1090,330 C1300,245 1450,390 1550,360"
            fill="none"
            stroke="url(#blueWisp2)"
            strokeWidth="1.8"
            strokeDasharray="8 6"
          />
          <path
            d="M-100,400 C350,250 710,555 1130,375 C1330,295 1475,435 1550,405"
            fill="none"
            stroke="url(#blueWisp1)"
            strokeWidth="1.6"
            strokeOpacity="0.75"
          />
          <path
            d="M-100,445 C390,295 750,595 1170,420 C1360,340 1495,475 1550,450"
            fill="none"
            stroke="url(#blueWisp2)"
            strokeWidth="1.3"
            strokeDasharray="5 6"
            strokeOpacity="0.6"
          />
          <path
            d="M-100,490 C430,345 790,635 1210,465 C1390,385 1515,520 1550,495"
            fill="none"
            stroke="url(#blueWisp1)"
            strokeWidth="1.2"
            strokeDasharray="8 8"
            strokeOpacity="0.5"
          />

          {/* Bottom Gold Wave Flow — Layered Contours */}
          <path
            d="M-100,670 C210,790 610,530 990,710 C1210,810 1420,630 1550,670"
            fill="none"
            stroke="url(#goldWisp2)"
            strokeWidth="1.4"
            strokeDasharray="6 6"
            strokeOpacity="0.5"
          />
          <path
            d="M-100,715 C245,835 645,575 1025,755 C1245,855 1445,675 1550,715"
            fill="none"
            stroke="url(#goldWisp1)"
            strokeWidth="2.2"
          />
          <path
            d="M-100,765 C285,885 685,625 1065,805 C1285,905 1475,725 1550,765"
            fill="none"
            stroke="url(#goldWisp1)"
            strokeWidth="1.8"
            strokeDasharray="8 5"
          />
          <path
            d="M-100,815 C320,930 720,670 1100,850 C1315,945 1495,775 1550,815"
            fill="none"
            stroke="url(#goldWisp2)"
            strokeWidth="1.5"
            strokeOpacity="0.55"
          />
        </svg>

        {/* Floating Currency Pills */}
        <div className="hidden lg:flex items-center gap-1.5 absolute top-44 left-16 px-3.5 py-1.5 rounded-full bg-white/80 border border-slate-200/80 shadow-sm backdrop-blur-sm text-xs font-semibold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          Auto-Converted to USDT
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
          <form onSubmit={handleDeposit} className="space-y-6">
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
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  onBlur={() => setAmount((v) => normalizeAmountInput(v))}
                  placeholder="0.00"
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
                    Credited to USDT Wallet:
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
                    {usdtEquivalent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                    <span className="text-sm font-bold text-teal-600">USDT</span>
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-0.5">
                  <p className="text-xs font-semibold text-stone-700 flex items-center gap-1.5 sm:justify-end">
                    <span>
                      1 USD = {formatRate(ratePerUsd)} {selectedCurrency.code}
                    </span>
                    {rates.status === "loading" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded-md">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> LIVE
                      </span>
                    ) : rateIsLive ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-md"
                        title={`Market reference rate published ${rates.status === "live" ? rates.data.date : ""}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> LIVE
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md"
                        title="Live rates unavailable — showing an indicative offline rate"
                      >
                        OFFLINE
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    Total Fee ({DEPOSIT_FEE_PERCENT}%): ${feeUsd.toFixed(2)} USD
                  </p>
                </div>
              </div>

              {/* Dedicated Stable Coin to USD Conversion Rate Row */}
              <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-stone-800">USD value after fee:</span>
                  <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    ${netUsd.toFixed(2)} USD
                  </span>
                </div>
                <div
                  className="flex items-center gap-1 text-[11px] font-medium text-stone-600 bg-white px-2.5 py-1 rounded-full border border-stone-200/80 shadow-2xs"
                  title={
                    rates.status === "live"
                      ? `Live market rate via ${rates.data.source}, published ${rates.data.date}`
                      : "Indicative rate — live feed unavailable"
                  }
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${rates.status === "live" ? "bg-green-500" : "bg-amber-500"}`} />
                  <span>
                    1 USD = {usdtPerUsd.toFixed(4)} USDT
                    {isMwk && ` · 1 USDT = ${formatRate(ratePerUsd / usdtPerUsd)} MWK`}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Methods Section */}
            <div className="space-y-3">
              <label className="text-xs sm:text-sm font-bold text-stone-800 uppercase tracking-wide">
                Payment Methods
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-[9px] font-black">
                        a
                      </div>
                      <span className="text-[9px] font-bold text-red-600 tracking-tight">airtel</span>
                    </div>
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
                  <span className="text-[10px] text-stone-500 font-medium">Instant</span>
                </button>
              </div>
            </div>

            {/* Error Message Banner */}
            {errorMsg && (
              <div className="w-full p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Bottom Action Section */}
            <div className="pt-2 flex flex-col items-center gap-3">
              <button
                type="submit"
                disabled={isDepositing || rawNumber <= 0}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-[0_6px_20px_rgba(201,162,39,0.3)] hover:shadow-[0_8px_25px_rgba(201,162,39,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all text-base text-center flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {isDepositing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Depositing Funds...</span>
                  </>
                ) : (
                  <span>Deposit Funds</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleInterceptNavigation("/analytics")}
                className="text-xs font-semibold text-stone-500 hover:text-stone-900 hover:underline transition-colors cursor-pointer"
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

      {/* Success Confirmation Modal */}
      {showSuccessModal && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-stone-200 transform animate-in zoom-in-95 duration-200 relative text-center">
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-3xl bg-green-50 border border-green-200 flex items-center justify-center text-green-600 mx-auto mb-4 shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-2xl font-extrabold text-stone-900 mb-1">
              Deposit Confirmed!
            </h3>
            <p className="text-sm text-stone-600 mb-5">
              Funds have been converted and credited directly into your USDT Wallet.
            </p>

            <div className="rounded-2xl bg-stone-50 border border-stone-200/80 p-4 space-y-2.5 text-left mb-6 text-sm">
              <div className="flex justify-between items-center text-stone-600">
                <span>Amount Credited:</span>
                <span className="font-extrabold text-teal-700 text-base">
                  +{successData.amount}
                </span>
              </div>
              <div className="flex justify-between items-center text-stone-600">
                <span>Charged From:</span>
                <span className="font-medium text-stone-900">
                  {successData.sourceName}
                </span>
              </div>
              <div className="flex justify-between items-center text-stone-600">
                <span>Destination:</span>
                <span className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  USDT Wallet
                </span>
              </div>
              {successData.appliedRate && (
                <div className="pt-2 border-t border-stone-200 flex justify-between items-start gap-3 text-xs text-stone-500">
                  <span className="shrink-0">Rate applied:</span>
                  <span className="text-right font-medium text-stone-700">
                    {successData.appliedRate}
                    {successData.rateSource && successData.rateSource !== "mock" && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-md align-middle">
                        {successData.rateSource.startsWith("pinned") ? "PINNED" : "LIVE"}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-900 shadow-md hover:brightness-105 active:scale-[0.99] transition-all text-sm cursor-pointer"
              >
                Go to Dashboard
              </button>

              <button
                type="button"
                onClick={() => router.push("/analytics")}
                className="w-full py-2.5 px-4 rounded-xl text-stone-600 hover:text-stone-900 text-xs font-semibold transition-colors cursor-pointer"
              >
                View in Analytics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Graceful Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 transform animate-in zoom-in-95 duration-200 relative">
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

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
