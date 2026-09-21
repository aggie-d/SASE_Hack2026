import Link from "next/link";
import { 
  BarChart3, 
  Globe, 
  ShieldCheck, 
  ArrowUpRight, 
  CreditCard, 
  CheckCircle2, 
  Sparkles 
} from "lucide-react";
import { DemoBanner } from "@/components/DemoBanner";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-stone-900 flex flex-col justify-between relative overflow-hidden font-sans">
      <DemoBanner />

      {/* Brand Background Atmosphere & Fluid Wisps (NO dot-grid) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Ambient Colorful Glows */}
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-blue-500/[0.08] rounded-full blur-[140px]" />
        <div className="absolute top-1/4 -right-32 w-[650px] h-[650px] bg-[#C9A227]/[0.09] rounded-full blur-[150px]" />
        <div className="absolute -bottom-32 left-1/3 w-[600px] h-[600px] bg-blue-400/[0.06] rounded-full blur-[140px]" />

        {/* Fluid Topographic Wispy Contour Lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="landingBlueWisp" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0066FF" stopOpacity="0.1" />
              <stop offset="40%" stopColor="#0066FF" stopOpacity="0.65" />
              <stop offset="75%" stopColor="#3B82F6" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="landingGoldWisp" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9A227" stopOpacity="0.1" />
              <stop offset="35%" stopColor="#DFB338" stopOpacity="0.7" />
              <stop offset="70%" stopColor="#F5D77F" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#B8911E" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Upper flowing blue waves */}
          <path
            d="M-100,160 C300,-10 680,260 1100,80 C1300,0 1450,160 1550,130"
            fill="none"
            stroke="url(#landingBlueWisp)"
            strokeWidth="2"
          />
          <path
            d="M-100,210 C340,40 720,310 1140,130 C1340,50 1480,210 1550,180"
            fill="none"
            stroke="url(#landingBlueWisp)"
            strokeWidth="1.5"
            strokeDasharray="8 6"
            strokeOpacity="0.5"
          />

          {/* Lower flowing gold waves */}
          <path
            d="M-100,690 C220,810 620,550 1000,730 C1220,830 1430,650 1550,690"
            fill="none"
            stroke="url(#landingGoldWisp)"
            strokeWidth="2"
          />
          <path
            d="M-100,740 C260,860 660,600 1040,780 C1260,880 1460,700 1550,740"
            fill="none"
            stroke="url(#landingGoldWisp)"
            strokeWidth="1.5"
            strokeDasharray="8 5"
            strokeOpacity="0.6"
          />
        </svg>
      </div>

      {/* Navigation Bar — Matching AppHeader Style */}
      <header 
        className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5"
        style={{ animation: "landing-fade-down 0.7s cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        <div className="bg-[#0B1528] rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-lg border border-slate-800">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-1 font-bold text-xl sm:text-2xl tracking-tight select-none group">
            <span className="text-[#C9A227] ml-0.5">LAD</span>
            <span className="text-white group-hover:text-blue-200 transition-colors">Transfer</span>
          </Link>

          {/* Auth Action Buttons */}
          <div className="flex items-center gap-3">
            <Link 
              href="/login" 
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/80 transition-all"
            >
              Log In
            </Link>
            <Link 
              href="/signup" 
              className="px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-b from-[#DFB338] to-[#B8911E] text-stone-900 shadow-md hover:brightness-105 active:scale-[0.99] transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column: Hero Text + Value Props + CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            {/* Pill Badge */}
            <div 
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-700 mb-6 shadow-2xs"
              style={{ animation: "landing-fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both" }}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#DFB338]" />
              <span>Next-Gen Global Spend · 1:1 Stablecoin Peg</span>
            </div>

            {/* Main Headline */}
            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-stone-900 leading-[1.12] mb-5"
              style={{ animation: "landing-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both" }}
            >
              Empower Your Money with{" "}
              <span className="text-[#C9A227] italic">LAD</span>
              <span className="text-stone-900">Transfer</span>
            </h1>

            {/* Subtitle */}
            <p 
              className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl mb-8"
              style={{ animation: "landing-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both" }}
            >
              Seamlessly deposit your local currency, auto-convert directly into USDT stablecoin, and instantly fund a virtual platinum card for global online shopping and subscriptions.
            </p>

            {/* CTA Buttons Row */}
            <div 
              className="flex flex-wrap items-center gap-3.5 sm:gap-4 mb-8 w-full sm:w-auto"
              style={{ animation: "landing-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both" }}
            >
              <Link
                href="/signup"
                className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] px-8 py-4 text-base font-bold text-stone-900 shadow-[0_8px_25px_rgba(201,162,39,0.35)] hover:shadow-[0_12px_32px_rgba(201,162,39,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <span>Sign Up</span>
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              </Link>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-2xl border-2 border-stone-300 hover:border-stone-400 bg-white/90 hover:bg-white px-7 py-4 text-base font-bold text-stone-800 shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <span>Sign In to Wallet</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive Phone Mockup + Floating Conversion Widget */}
          <div className="lg:col-span-5 flex items-center justify-center relative select-none">
            {/* Ambient Radial Backlight behind the Mockups */}
            <div className="absolute w-72 h-72 sm:w-96 sm:h-96 bg-gradient-to-tr from-blue-500/20 via-[#DFB338]/15 to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Container for the Phone + Overlapping Floating Widget with Entry Animation */}
            <div 
              className="relative w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[460px] flex items-center justify-center"
              style={{ animation: "landing-scale-in 1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both" }}
            >
              {/* Phone Mockup with Gentle Floating Idle Animation */}
              <div 
                className="w-full flex items-center justify-center"
                style={{ animation: "float-gentle 6s ease-in-out infinite alternate 1.3s" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/phone-mockup-removebg-preview.png"
                  alt="LADTransfer Virtual Card Mobile Preview"
                  className="w-full h-auto max-h-[480px] lg:max-h-[520px] object-contain drop-shadow-[0_25px_45px_rgba(11,21,40,0.28)] pointer-events-none"
                />
              </div>

              {/* Overlapping Conversion Widget with Staggered Entry + Subtle Float */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 -left-6 sm:-left-12 lg:-left-16 w-44 sm:w-56 lg:w-60 rounded-2xl shadow-[0_20px_45px_rgba(11,21,40,0.35)] border-2 border-white/80 overflow-hidden backdrop-blur-md hover:scale-105 transition-transform duration-300 pointer-events-auto"
                style={{ 
                  animation: "landing-scale-in 1s cubic-bezier(0.16, 1, 0.3, 1) 0.55s both" 
                }}
              >
                <div style={{ animation: "widget-bob 5s ease-in-out infinite alternate 1.5s" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/conversion-widget.jpg"
                    alt="Live Currency Conversion Widget"
                    className="w-full h-auto object-cover rounded-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards Section — Matching Dashboard Deep Midnight Theme */}
        <div className="mt-12 lg:mt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            {/* Feature 1: Transparent Fees */}
            <div 
              className="bg-[#0B1528] rounded-2xl p-5 sm:p-6 border border-slate-800 text-left shadow-lg hover:border-[#DFB338]/50 hover:shadow-[0_12px_30px_rgba(11,21,40,0.2)] hover:-translate-y-1 transition-all duration-300 group"
              style={{ animation: "landing-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both" }}
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div className="w-11 h-11 rounded-xl bg-[#DFB338]/15 border border-[#DFB338]/30 flex items-center justify-center text-[#DFB338] group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Transparent Pricing
                </h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Live exchange rates with minimal fees. Deposit any local currency and know exactly what you get.
              </p>
            </div>

            {/* Feature 2: Global Spend */}
            <div 
              className="bg-[#0B1528] rounded-2xl p-5 sm:p-6 border border-slate-800 text-left shadow-lg hover:border-[#DFB338]/50 hover:shadow-[0_12px_30px_rgba(11,21,40,0.2)] hover:-translate-y-1 transition-all duration-300 group"
              style={{ animation: "landing-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both" }}
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <CreditCard className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Global Virtual Card
                </h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Instant virtual card accepted anywhere online worldwide for shopping, software, and travel.
              </p>
            </div>

            {/* Feature 3: Bank-Grade Security */}
            <div 
              className="bg-[#0B1528] rounded-2xl p-5 sm:p-6 border border-slate-800 text-left shadow-lg hover:border-[#DFB338]/50 hover:shadow-[0_12px_30px_rgba(11,21,40,0.2)] hover:-translate-y-1 transition-all duration-300 group"
              style={{ animation: "landing-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.8s both" }}
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Bank-Grade Security
                </h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Immutable double-entry cryptographic ledger and robust fraud protections safeguarding your funds.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer 
        className="relative z-10 py-5 text-center text-xs text-stone-500 border-t border-slate-200/60"
        style={{ animation: "landing-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.9s both" }}
      >
        <p>© 2026 LADTransfer. All rights reserved. Secure global transfers and virtual cards.</p>
      </footer>
    </div>
  );
}
