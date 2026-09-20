import type { ReactNode } from "react";
import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";

type PageShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <div className="min-h-screen">
      <DemoBanner />
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold text-stone-900">
            LAD Transfer
          </Link>
          <nav className="flex gap-3 text-sm text-stone-600">
            <Link href="/login">Sign in</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/analytics">Analytics</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-stone-600">{description}</p>
        <section className="mt-6 rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
          {children ?? "This page is a placeholder. Replace this section with the screen."}
        </section>
      </main>
    </div>
  );
}
