import { assetAllocation } from "./individual-dashboard-data";

export function AssetAllocation() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="asset-allocation-heading">
      <h2 id="asset-allocation-heading" className="text-lg font-extrabold text-star-900">Asset Allocation</h2>
      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start lg:flex-col lg:items-center 2xl:flex-row 2xl:items-start">
        <div className="relative h-40 w-40 shrink-0" role="img" aria-label="Asset allocation is zero percent across Fixed Note, Discretionary Portfolios, Execution Mandate and Cash for this new investor.">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true"><circle cx="80" cy="80" r="57" fill="none" stroke="#EDF6DE" strokeWidth="20" /><circle cx="80" cy="80" r="57" fill="none" stroke="#D9EAC8" strokeWidth="20" strokeDasharray="3 5" /></svg>
          <div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-xl font-extrabold tracking-[-0.04em] text-star-900">₦0.00</p><p className="mt-1 text-xs text-star-muted">Total Value</p></div></div>
        </div>
        <ul className="w-full space-y-3" aria-label="Zero value asset allocation legend">{assetAllocation.map(({ label, percent, color }) => <li key={label} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-star-700"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />{label}</span><span className="font-extrabold text-star-900">{percent}%</span></li>)}</ul>
      </div>
      <p className="mt-5 text-xs text-star-muted">Allocation will update after your first investment.</p>
    </section>
  );
}
