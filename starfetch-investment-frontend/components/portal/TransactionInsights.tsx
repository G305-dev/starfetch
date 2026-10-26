import { transactionInsights } from "./transactions-data";

const radius = 58;
const circumference = 2 * Math.PI * radius;

export function TransactionInsights() {
  let cumulativePercent = 0;

  return (
    <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="transaction-insights-heading">
      <h2 id="transaction-insights-heading" className="text-lg font-extrabold text-star-900">Transaction Insights</h2>
      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start lg:flex-col lg:items-center 2xl:flex-row 2xl:items-start">
        <div className="relative h-40 w-40 shrink-0" role="img" aria-label="Sample transaction mix: Investment Funded 44.4 percent, Return Payment 27.8 percent, Deposit 11.1 percent, Withdrawal 11.1 percent, Failed 5.6 percent.">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="80" cy="80" r={radius} fill="none" stroke="#EDF6DE" strokeWidth="19" />
            {transactionInsights.map((insight) => {
              const dash = (insight.percent / 100) * circumference;
              const offset = -(cumulativePercent / 100) * circumference;
              cumulativePercent += insight.percent;
              return <circle key={insight.label} cx="80" cy="80" r={radius} fill="none" stroke={insight.color} strokeWidth="19" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={offset} />;
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-2xl font-extrabold tracking-[-0.04em] text-star-900">18</p><p className="mt-0.5 text-[0.63rem] font-bold uppercase tracking-[0.12em] text-star-muted">Transactions</p></div></div>
        </div>
        <ul className="w-full space-y-2.5" aria-label="Transaction mix legend">
          {transactionInsights.map(({ label, count, percent, color }) => (
            <li key={label} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-star-700"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" /> <span className="truncate font-semibold">{label}</span></span>
              <span className="shrink-0 font-bold text-star-muted">{count} · {percent}%</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-5 text-xs text-star-muted">Transaction mix is calculated from temporary frontend mock data.</p>
    </section>
  );
}
