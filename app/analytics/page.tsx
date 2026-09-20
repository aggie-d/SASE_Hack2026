"use client";

import { AppHeader } from "@/components/AppHeader";

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

const recentTransactions = [
  {
    date: "Jul 29",
    merchant: "Verizon Wireless",
    amount: "-$115.40",
    category: "Phone Bill",
  },
  {
    date: "Jul 28",
    merchant: "Safeway",
    amount: "-$98.15",
    category: "Groceries",
  },
  {
    date: "Jul 26",
    merchant: "Amazon.com",
    amount: "-$154.99",
    category: "Shopping",
  },
  {
    date: "Jul 25",
    merchant: "Delta Air Lines",
    amount: "-$745.20",
    category: "Travel",
  },
  {
    date: "Jul 24",
    merchant: "Adobe Inc.",
    amount: "-$52.99",
    category: "Subscription",
  },
  {
    date: "Jul 23",
    merchant: "Local Chevron",
    amount: "-$61.70",
    category: "Gas",
  },
  {
    date: "Jul 21",
    merchant: "Netflix",
    amount: "-$19.99",
    category: "Subscription",
  },
];

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-stone-900 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background: Dot-Matrix Grid (matches Dashboard) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: "radial-gradient(#94a3b8 1.25px, transparent 1.25px)",
          backgroundSize: "26px 26px",
        }}
      />
      {/* Soft Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[350px] bg-blue-400/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[350px] bg-[#C9A227]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Circuit Tech Lines (matches Dashboard) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,150 L200,150 L260,210 L500,210" fill="none" stroke="#0066FF" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="260" cy="210" r="3.5" fill="#0066FF" />
        <path d="M1000,600 L1200,600 L1260,540 L1600,540" fill="none" stroke="#C9A227" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="1260" cy="540" r="3.5" fill="#C9A227" />
        <circle cx="200" cy="150" r="2.5" fill="#0066FF" />
      </svg>

      {/* Consistent Navigation Header */}
      <AppHeader active="analytics" />

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-4xl mx-auto flex-1 flex flex-col items-center px-4 py-8 sm:py-10">
        <div className="w-full space-y-6">
          {/* Page Title */}
          <div className="text-center mb-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 mb-2">
              Expense Analytics
            </h1>
            <p className="text-sm sm:text-base text-stone-600 max-w-md mx-auto">
              Review your monthly spending and recent outgoing transactions.
            </p>
          </div>

          {/* Monthly Expense Summary Card */}
          <div className="bg-[#0B1528] rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 text-white relative overflow-hidden text-center">
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
            <div className="bg-[#0B1528] rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 text-white">
              <h2 className="text-base sm:text-lg font-bold text-white">
                Monthly Spending Categorization
              </h2>

              <div className="mt-6 flex flex-col items-center gap-7 sm:flex-row">
                <div
                  aria-label="Monthly spending donut chart"
                  className="relative h-44 w-44 shrink-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(#DFB338 0% 38%, #60a5fa 38% 60%, #0066FF 60% 76%, #C9A227 76% 90%, #0b4f93 90% 100%)",
                  }}
                >
                  <div className="absolute inset-12 rounded-full bg-[#0B1528]" />
                </div>

                <ul className="w-full space-y-3">
                  {spendingCategories.map((category) => (
                    <li
                      key={category.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
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
            <div className="bg-[#0B1528] rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 text-white">
              <h2 className="text-base sm:text-lg font-bold text-white">
                Recent Transactions
              </h2>

              <p className="mt-1 text-xs text-slate-500">Outgoing only</p>

              <div className="mt-4 divide-y divide-slate-700/60">
                {recentTransactions.map((transaction) => (
                  <article
                    key={`${transaction.date}-${transaction.merchant}`}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3"
                  >
                    <time className="text-xs text-slate-500 font-medium">
                      {transaction.date}
                    </time>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {transaction.merchant}
                      </p>
                      <p className="text-xs text-[#DFB338]">
                        {transaction.category}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-[#DFB338]">
                      {transaction.amount}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-stone-500">
        <p>© 2026 LADTransfer. All rights reserved.</p>
      </footer>
    </div>
  );
}