import { Bell } from "lucide-react";

export function LatestUpdates() {
  return <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="latest-updates-heading"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-star-50 text-star-700"><Bell size={19} aria-hidden="true" /></span><h2 id="latest-updates-heading" className="text-lg font-extrabold text-star-900">Latest Updates</h2></div><div className="flex min-h-[132px] flex-col items-center justify-center text-center"><p className="text-sm font-bold text-star-900">No account updates yet</p><p className="mt-2 max-w-xs text-xs leading-5 text-star-muted">Updates will appear here when an account activity source is available.</p></div></section>;
}
