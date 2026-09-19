import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";

export default function Home() {
  return (
    <div className="min-h-screen">
      <DemoBanner />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">LAD Transfer</h1>
        <p className="mt-3 max-w-xl text-stone-600">
          Deposit MWK, convert to USDT, and fund a virtual card for a simulated
          international purchase.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900"
          >
            Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
