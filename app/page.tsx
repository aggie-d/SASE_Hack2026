import Link from "next/link";
import { BarChart3, Globe, Lock } from "lucide-react";
import { DemoBanner } from "@/components/DemoBanner";

export default function Home() {
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#0066FF] text-white flex flex-col">
      <DemoBanner />
      {/* Navigation — logo + login/get started only */}
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-1 font-bold text-2xl tracking-tight">
          <span className="text-[#C9A227] text-3xl">LT</span>
          <span className="text-[#C9A227] ml-1">LAD</span>
          <span className="text-stone-900">Transfer</span>
        </Link>
        <div className="flex gap-x-4">
          <Link href="/login" className="rounded-full border border-stone-900 bg-transparent px-5 py-2 text-sm font-semibold text-stone-900 hover:bg-white/10 transition-colors">
            Login
          </Link>
          <Link href="/signup" className="rounded-full bg-[#C9A227] px-5 py-2 text-sm font-semibold text-stone-900 shadow-sm hover:bg-[#B8911E] transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Main content — flex column, fills remaining height */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
        {/* Hero + phone row — takes all remaining space above the cards */}
        <div className="flex-1 relative mx-auto flex w-full max-w-7xl items-center px-6 lg:px-8 min-h-0">
          {/* Left: text + CTA */}
          <div className="max-w-xl flex-shrink-0 z-10">
            <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
              <span className="text-[#C9A227] italic">LAD</span>
              <span className="text-stone-900">Transfer</span>
            </h1>
            <p className="mt-5 text-lg leading-8 text-blue-100 max-w-md">
              Use your Malawian Kwacha for international online purchases. Seamlessly convert MWK to fund a virtual card for global spending.
            </p>
            <div className="mt-7">
              <Link
                href="/login"
                className="rounded-full bg-[#C9A227] px-8 py-3.5 text-base font-semibold text-stone-900 shadow-md hover:bg-[#B8911E] transition-colors"
              >
                Login / Sign Up
              </Link>
            </div>
          </div>

          {/* Right: phone + floating conversion widget */}
          <div
            className="hidden lg:block absolute right-0 inset-y-0 pointer-events-none select-none"
            aria-hidden="true"
          >
            {/* Phone image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/phone-mockup-removebg-preview.png"
              alt=""
              className="h-full w-auto object-contain object-top drop-shadow-2xl"
            />
            {/* Conversion widget — overlaps the phone on the left, vertically centred */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/conversion-widget.jpg"
              alt=""
              className="absolute top-1/2 -translate-y-1/3 -left-36 w-48 rounded-2xl shadow-2xl"
            />
          </div>
        </div>

        {/* Feature cards — transparent background so phone peeks out behind */}
        <div className="relative z-10 pb-5">
          <div className="mx-auto max-w-7xl px-6 pt-4 lg:px-8">
            <dl className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="flex items-start gap-x-4 bg-white rounded-2xl p-5 border border-stone-200/50 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                  <BarChart3 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <dt className="text-base font-bold text-stone-900">Transparent Fees</dt>
                  <dd className="mt-1 text-sm leading-6 text-stone-600">Clear pricing and no hidden charges for global pricing.</dd>
                </div>
              </div>
              <div className="flex items-start gap-x-4 bg-white rounded-2xl p-5 border border-stone-200/50 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                  <Globe className="h-5 w-5 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <dt className="text-base font-bold text-stone-900">Global Spend</dt>
                  <dd className="mt-1 text-sm leading-6 text-stone-600">Worldwide acceptance in the virtual credit card.</dd>
                </div>
              </div>
              <div className="flex items-start gap-x-4 bg-white rounded-2xl p-5 border border-stone-200/50 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                  <Lock className="h-5 w-5 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <dt className="text-base font-bold text-stone-900">Secure</dt>
                  <dd className="mt-1 text-sm leading-6 text-stone-600">Advanced security protocols and fraud protection.</dd>
                </div>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
