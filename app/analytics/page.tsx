"use client";

import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { formatMinorUnits, parseMinorUnits } from "@/lib/contracts/money";
import type { ActivityListResponse } from "@/lib/contracts";

const spendingCategories = [
  {
    name: "Rent & Utilities",
    percentage: 38,
    color: "#DFB338",
  },
  {
    name: "Food & Groceries",
    percentage: 22,
    color: "#60a5fa",
  },
  {
    name: "Travel & Transport",
    percentage: 16,
    color: "#0066FF",
  },
  {
    name: "Shopping",
    percentage: 14,
    color: "#C9A227",
  },
  {
    name: "Services & Subscriptions",
    percentage: 10,
    color: "#0b4f93",
  },
];

type TransactionViewItem = {
  id?: string;
  date: string;
  merchant: string;
  amount: string;
  category: string;
};

export default function AnalyticsPage() {
  const [recentTransactions, setRecentTransactions] = useState<TransactionViewItem[]>([
    {
      id: "tx-default-1",
      date: "Jul 29",
      merchant: "Verizon Wireless",
      amount: "-$115.40",
      category: "Phone Bill",
    },
    {
      id: "tx-default-2",
      date: "Jul 28",
      merchant: "Safeway",
      amount: "-$98.15",
      category: "Groceries",
    },
  ]);

  useEffect(() => {
    async function loadActivity() {
      try {
        const res = await fetch("/api/v1/activity?limit=20");
        if (res.ok) {
          const data = (await res.json()) as ActivityListResponse;
          const txs = data.items.map(item => {
            const d = new Date(item.created_at);
            const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const amtUnits = parseMinorUnits(item.amount.amount_units);
            const amtStr = formatMinorUnits(amtUnits, item.amount.asset, { code: false });
            return {
              id: item.id,
              date: dateStr,
              merchant: item.title,
              amount: (item.type === "purchase" || item.type === "conversion" ? "-" : "+") + "$" + amtStr,
              category: item.type.charAt(0).toUpperCase() + item.type.slice(1),
            };
          });
          if (txs.length > 0) {
            setRecentTransactions(txs);
          }
        }
      } catch (err) {
        console.error("Failed to fetch activity", err);
      }
    }
    loadActivity();
  }, []);

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

      {/* Soft Ambient Glows */}
      <div
        className="absolute top-0 left-1/4 w-[500px] h-[350px] bg-blue-400/10 rounded-full blur-[130px] pointer-events-none"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.1s both" }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[500px] h-[350px] bg-[#C9A227]/10 rounded-full blur-[140px] pointer-events-none"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.35s both" }}
      />

      {/* Circuit Tech Lines */}
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
        <AppHeader active="analytics" />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-6xl xl:max-w-7xl mx-auto flex-1 flex flex-col items-center px-4 py-8 sm:py-10">
        <div className="w-full space-y-6">

          {/* Monthly Expense Summary Card */}
          <div 
            className="bg-[#0B1528] rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 text-white relative overflow-hidden text-center"
            style={{ animation: "wave-lift 0.9s ease-in-out 0.22s both" }}
          >
            {/* Subtle card glow */}
            <div className="absolute -top-24 right-10 w-64 h-64 bg-[#C9A227]/10 rounded-full blur-[70px] pointer-events-none" />

            <div className="relative z-10">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400">
                Total Expenses{" "}
                <span className="font-normal normal-case text-slate-500">
                  (Current Month)
                </span>
              </p>

              <p className="mt-3 text-4xl sm:text-5xl font-extrabold text-[#DFB338] tracking-tight">
                $4,875.20
              </p>

              <p className="mt-3 text-sm text-slate-400">
                vs Last Month:{" "}
                <span className="font-semibold text-emerald-400">↑ 8.5%</span>
              </p>
            </div>
          </div>

          {/* Analytics Panels */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Spending Categories Card */}
            <div 
              className="bg-[#0B1528] rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 text-white flex flex-col h-[420px] sm:h-[350px]"
              style={{ animation: "wave-lift 0.9s ease-in-out 0.30s both" }}
            >
              <h2 className="text-base sm:text-lg font-bold text-white shrink-0">
                Monthly Spending Categorization
              </h2>

              <div className="mt-4 sm:mt-6 flex-1 flex flex-col items-center justify-center gap-6 sm:gap-7 sm:flex-row">
                <div
                  aria-label="Monthly spending donut chart"
                  className="relative h-36 w-36 sm:h-44 sm:w-44 shrink-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(#DFB338 0% 38%, #60a5fa 38% 60%, #0066FF 60% 76%, #C9A227 76% 90%, #0b4f93 90% 100%)",
                  }}
                >
                  <div className="absolute inset-10 sm:inset-12 rounded-full bg-[#0B1528]" />
                </div>

                <ul className="w-full space-y-2.5 sm:space-y-3">
                  {spendingCategories.map((category) => (
                    <li
                      key={category.name}
                      className="flex items-center justify-between gap-3 text-xs sm:text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-slate-300">{category.name}</span>
                      </span>

                      <span className="font-semibold text-white">
                        {category.percentage}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recent Transactions Card */}
            <div 
              className="bg-[#0B1528] rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 text-white flex flex-col h-[420px] sm:h-[350px]"
              style={{ animation: "wave-lift 0.9s ease-in-out 0.38s both" }}
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Recent Transactions
                </h2>
                <span className="text-xs text-slate-400 font-medium">
                  {recentTransactions.length} {recentTransactions.length === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="mt-4 divide-y divide-slate-700/60 overflow-y-auto flex-1 pr-1.5 custom-scrollbar">
                {recentTransactions.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 py-8">
                    No transactions recorded yet
                  </div>
                ) : (
                  recentTransactions.map((transaction, i) => (
                    <article
                      key={transaction.id || `${transaction.date}-${transaction.merchant}-${i}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3"
                    >
                      <time className="text-xs text-slate-500 font-medium shrink-0 w-12">
                        {transaction.date}
                      </time>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {transaction.merchant}
                        </p>
                        <p className="text-xs text-[#DFB338] truncate">
                          {transaction.category}
                        </p>
                      </div>

                      <p className="text-sm font-semibold text-[#DFB338] shrink-0 text-right">
                        {transaction.amount}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer 
        className="relative z-10 py-5 text-center text-xs text-stone-500"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.45s both" }}
      >
        <p>© 2026 LADTransfer. All rights reserved.</p>
      </footer>
    </div>
  );
}