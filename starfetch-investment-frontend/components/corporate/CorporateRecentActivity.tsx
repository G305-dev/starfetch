import { corporateRecentActivity } from "./corporate-dashboard-data";

export function CorporateRecentActivity() {
  return (
    <section id="activity" className="scroll-mt-24 rounded-lg border border-star-200 bg-white" aria-labelledby="corporate-recent-activity-heading">
      <div className="border-b border-star-200 px-5 py-4"><h2 id="corporate-recent-activity-heading" className="text-lg font-extrabold text-star-900">Recent Activity</h2></div>
      <div className="hidden md:block"><table className="w-full text-left"><thead className="bg-star-50 text-xs font-bold text-star-muted"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-star-100">{corporateRecentActivity.map((item) => <tr key={item.date}><td className="px-5 py-4 text-sm font-semibold text-star-700">{item.date}</td><td className="px-5 py-4 text-sm font-semibold text-star-900">{item.description}</td><td className="px-5 py-4 text-sm font-extrabold text-star-900">{item.amount}</td><td className="px-5 py-4"><span className="inline-flex rounded-full bg-star-100 px-2.5 py-1 text-xs font-bold text-star-700">{item.status}</span></td></tr>)}</tbody></table></div>
      <div className="grid divide-y divide-star-100 md:hidden">{corporateRecentActivity.map((item) => <article key={item.date} className="p-5"><p className="text-sm font-extrabold text-star-900">{item.description}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><p><span className="block text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Date</span><span className="mt-1 block font-semibold text-star-700">{item.date}</span></p><p><span className="block text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Amount</span><span className="mt-1 block font-extrabold text-star-900">{item.amount}</span></p></div><span className="mt-4 inline-flex rounded-full bg-star-100 px-2.5 py-1 text-xs font-bold text-star-700">{item.status}</span></article>)}</div>
    </section>
  );
}
