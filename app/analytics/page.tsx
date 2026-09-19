import { PageShell } from "@/components/PageShell";

const spendingCategories = [
  {
    name: "Rent & Utilities",
    percentage: 38,
    color: "#f5c84c",
  },
  {
    name: "Food & Groceries",
    percentage: 22,
    color: "#60a5fa",
  },
  {
    name: "Travel & Transport",
    percentage: 16,
    color: "#1677d2",
  },
  {
    name: "Shopping",
    percentage: 14,
    color: "#f1b936",
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
    <PageShell
      title="Expense Analytics"
      description="Review your monthly spending and recent outgoing transactions."
    >
      <div className="space-y-6 text-stone-100">
        {/* Monthly expense summary */}
        <section className="rounded-2xl bg-gradient-to-r from-blue-950 to-blue-800 px-6 py-8 text-center shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
            Total Expenses{" "}
            <span className="font-normal normal-case text-blue-200">
              (Current Month)
            </span>
          </p>

          <p className="mt-3 text-4xl font-bold text-amber-300 sm:text-5xl">
            $4,875.20
          </p>

          <p className="mt-3 text-sm text-blue-100">
            vs Last Month:{" "}
            <span className="font-semibold text-emerald-300">↑ 8.5%</span>
          </p>
        </section>

        {/* Analytics panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Spending categories */}
          <section className="rounded-2xl bg-slate-950 p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-white">
              Monthly Spending Categorization
            </h2>

            <div className="mt-6 flex flex-col items-center gap-7 sm:flex-row">
              <div
                aria-label="Monthly spending donut chart"
                className="relative h-44 w-44 shrink-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(#f5c84c 0% 38%, #60a5fa 38% 60%, #1677d2 60% 76%, #f1b936 76% 90%, #0b4f93 90% 100%)",
                }}
              >
                <div className="absolute inset-12 rounded-full bg-slate-950" />
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
                      <span className="text-slate-200">{category.name}</span>
                    </span>

                    <span className="font-semibold text-white">
                      {category.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Recent outgoing transactions */}
          <section className="rounded-2xl bg-slate-950 p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-white">
              Recent Transactions
            </h2>

            <p className="mt-1 text-xs text-slate-400">Outgoing only</p>

            <div className="mt-4 divide-y divide-slate-700">
              {recentTransactions.map((transaction) => (
                <article
                  key={`${transaction.date}-${transaction.merchant}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3"
                >
                  <time className="text-xs text-slate-400">
                    {transaction.date}
                  </time>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {transaction.merchant}
                    </p>
                    <p className="text-xs text-amber-300">
                      {transaction.category}
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-amber-300">
                    {transaction.amount}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}