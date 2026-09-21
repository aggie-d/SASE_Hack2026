"use client";

import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { formatMinorUnits, parseMinorUnits } from "@/lib/contracts/money";
import type { ActivityListResponse } from "@/lib/contracts";
import { PieChart } from "lucide-react";

type SpendingCategory = {
  name: string;
  percentage: number;
  color: string;
};

const CATEGORY_COLORS = ["#DFB338", "#60a5fa", "#0066FF", "#C9A227", "#0b4f93", "#10b981", "#a855f7"];

type TransactionViewItem = {
  id?: string;
  date: string;
  merchant: string;
  amount: string;
  category: string;
  isExpense?: boolean;
  numericAmount?: number;
};

export default function AnalyticsPage() {
  const [spendingCategories, setSpendingCategories] = useState<SpendingCategory[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionViewItem[]>([]);
  const [totalExpensesUsd, setTotalExpensesUsd] = useState("0.00");

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
            const isExpense = item.type === "purchase" || item.type === "conversion";
            const numUnits = Number(amtUnits);
            // Convert to USD value (MWK rate ~2000, USDT exponent 6)
            const numericAmount = item.amount.asset === "MWK" ? numUnits / 200000 : numUnits / 1000000;

            return {
              id: item.id,
              date: dateStr,
              merchant: item.title,
              amount: (isExpense ? "-" : "+") + "$" + amtStr,
              category: item.type.charAt(0).toUpperCase() + item.type.slice(1),
              isExpense,
              numericAmount,
            };
          });

          setRecentTransactions(txs);

          // Calculate actual total expenses
          const expenseItems = txs.filter((t) => t.isExpense);
          const totalSpent = expenseItems.reduce((acc, curr) => acc + (curr.numericAmount || 0), 0);
          setTotalExpensesUsd(totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

          // Calculate category breakdown if expenses exist
          if (expenseItems.length > 0 && totalSpent > 0) {
            const catMap: Record<string, number> = {};
            expenseItems.forEach((t) => {
              const cat = t.category || "Other";
              catMap[cat] = (catMap[cat] || 0) + (t.numericAmount || 0);
            });

            const computedCategories: SpendingCategory[] = Object.entries(catMap)
              .map(([name, val], idx) => ({
                name,
                percentage: Math.round((val / totalSpent) * 100),
                color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
              }))
              .sort((a, b) => b.percentage - a.percentage);

            setSpendingCategories(computedCategories);
          } else {
            setSpendingCategories([]);
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
                ${totalExpensesUsd}
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

              {spendingCategories.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-[#DFB338]/10 border border-[#DFB338]/20 flex items-center justify-center text-[#DFB338] mb-3 shadow-inner">
                    <PieChart className="w-7 h-7 stroke-[1.8]" />
                  </div>
                  <p className="text-sm font-bold text-white max-w-xs">
                    Start spending to track your spending habits!
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                    Your categorized breakdown and charts will automatically update here as you use your card.
                  </p>
                </div>
              ) : (
                <div className="mt-4 sm:mt-6 flex-1 flex flex-col items-center justify-center gap-6 sm:gap-7 sm:flex-row">
                  <div
                    aria-label="Monthly spending donut chart"
                    className="relative h-36 w-36 sm:h-44 sm:w-44 shrink-0 rounded-full"
                    style={{
                      background: `conic-gradient(${spendingCategories
                        .map((cat, idx, arr) => {
                          const prevSum = arr.slice(0, idx).reduce((s, c) => s + c.percentage, 0);
                          const nextSum = prevSum + cat.percentage;
                          return `${cat.color} ${prevSum}% ${nextSum}%`;
                        })
                        .join(", ")})`,
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
              )}
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