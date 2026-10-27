import { Bell, ChevronDown, Search } from "lucide-react";
import { Logo } from "@/components/ui";
import { dashboardUser } from "./dashboard-data";

export function PortalHeader() {
  return (
    <header className="sticky top-0 z-40 flex min-h-[76px] items-center justify-between border-b border-star-200 bg-white/95 px-5 backdrop-blur-sm sm:px-8 lg:px-8 xl:px-10">
      <div className="pl-14 lg:hidden"><Logo href="/" /></div>
      <label className="relative ml-6 hidden min-w-0 flex-1 lg:block lg:max-w-[520px]">
        <span className="sr-only">Global portal search</span>
        <Search size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-star-700" aria-hidden="true" />
        <input type="search" placeholder="Search investments, transactions, or help..." className="h-11 w-full rounded-md border border-star-100 bg-star-50 px-11 text-sm text-star-900 outline-none transition placeholder:text-star-muted focus:border-star-700 focus:ring-2 focus:ring-star-100" />
      </label>
      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <button type="button" className="relative grid h-10 w-10 place-items-center rounded-full text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2" aria-label="Notifications are unavailable in this dashboard mockup" title="Notifications are unavailable in this dashboard mockup"><Bell size={21} strokeWidth={2} aria-hidden="true" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true" /></button>
        <button type="button" className="flex items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 sm:gap-3 sm:px-2" aria-label={`${dashboardUser.fullName}, ${dashboardUser.accountType}. Profile menu unavailable in this dashboard mockup.`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-star-900 text-sm font-extrabold text-white">{dashboardUser.initials}</span>
          <span className="hidden min-w-0 sm:block"><span className="block truncate text-sm font-extrabold text-star-900">{dashboardUser.fullName}</span><span className="mt-0.5 block text-xs text-star-muted">{dashboardUser.accountType}</span></span>
          <ChevronDown size={16} className="hidden shrink-0 text-star-700 sm:block" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
