import { Bell, ChevronDown } from "lucide-react";
import { corporateCompany } from "./corporate-dashboard-data";

export function CorporateTopbar({ sectionLabel = "Overview" }: { sectionLabel?: string }) {
  return (
    <header className="sticky top-0 z-40 flex min-h-[62px] items-center justify-between border-b border-star-200 bg-white/95 px-5 backdrop-blur-sm sm:px-8 lg:px-9" aria-label="Corporate portal header">
      <p className="ml-12 text-sm font-semibold text-star-700 lg:ml-0">{sectionLabel} <ChevronDown size={15} className="ml-1 inline-block align-[-2px] text-star-muted" aria-hidden="true" /></p>
      <div className="flex items-center gap-3 sm:gap-4"><button type="button" aria-label="Notifications are unavailable in this corporate dashboard mockup" title="Notifications are unavailable in this corporate dashboard mockup" className="relative grid h-10 w-10 place-items-center rounded-full text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><Bell size={20} aria-hidden="true" /><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-star-lime ring-2 ring-white" aria-hidden="true" /></button><span className="hidden h-7 w-px bg-star-200 sm:block" aria-hidden="true" /><button type="button" aria-label={`${corporateCompany.name} profile menu unavailable in this dashboard mockup`} className="flex items-center gap-2 rounded-md p-1 text-left transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-star-100 text-xs font-extrabold text-star-900">{corporateCompany.initials}</span><span className="hidden text-sm font-bold text-star-900 sm:block">{corporateCompany.name}</span><ChevronDown size={16} className="hidden text-star-700 sm:block" aria-hidden="true" /></button></div>
    </header>
  );
}
