import { corporateInvestments } from "./corporate-dashboard-data";

function InvestmentStatusBadge({ status }: { status: "Active" | "Pending funding" }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === "Active" ? "bg-star-100 text-star-700" : "bg-[#fff4cf] text-[#806211]"}`}>{status}</span>;
}

export function CorporateInvestmentTable() {
  return (
    <section id="investments" className="scroll-mt-24 rounded-lg border border-star-200 bg-white" aria-labelledby="corporate-investment-heading">
      <div className="border-b border-star-200 px-5 py-4"><h2 id="corporate-investment-heading" className="text-lg font-extrabold text-star-900">Investment Portfolio</h2></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[680px] text-left"><thead className="bg-star-50 text-xs font-bold text-star-muted"><tr><th className="px-5 py-3">Investment</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Amount Invested</th><th className="px-5 py-3">Maturity Date</th></tr></thead><tbody className="divide-y divide-star-100">{corporateInvestments.map(({ name, status, amount, maturityDate, icon: Icon }) => <tr key={name}><td className="px-5 py-4"><span className="flex items-center gap-3 font-semibold text-star-900"><span className="text-star-700" aria-hidden="true"><Icon size={19} /></span>{name}</span></td><td className="px-5 py-4"><InvestmentStatusBadge status={status} /></td><td className="px-5 py-4 font-bold tabular-nums text-star-900">{amount}</td><td className="px-5 py-4 text-sm font-semibold text-star-700">{maturityDate}</td></tr>)}</tbody></table></div>
      <div className="grid divide-y divide-star-100 md:hidden">{corporateInvestments.map(({ name, status, amount, maturityDate, icon: Icon }) => <article key={name} className="p-5"><div className="flex items-start justify-between gap-3"><span className="flex items-center gap-3 font-bold text-star-900"><span className="text-star-700" aria-hidden="true"><Icon size={19} /></span>{name}</span><InvestmentStatusBadge status={status} /></div><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Amount invested</dt><dd className="mt-1 font-extrabold text-star-900">{amount}</dd></div><div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Maturity date</dt><dd className="mt-1 font-bold text-star-700">{maturityDate}</dd></div></dl></article>)}</div>
    </section>
  );
}
