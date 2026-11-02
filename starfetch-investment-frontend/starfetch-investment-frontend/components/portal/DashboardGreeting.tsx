import { RefreshCw } from "lucide-react";
import { dashboardUser } from "./dashboard-data";

export function DashboardGreeting() {
  return (
    <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="font-display text-[clamp(1.9rem,3.2vw,2.65rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-star-900">
          Good morning, {dashboardUser.firstName} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-2 text-sm leading-6 text-star-muted sm:text-[0.96rem]">Here&apos;s an overview of your investments and account activity.</p>
      </div>
      <div className="flex items-center gap-2 self-start text-xs text-star-muted xl:self-auto">
        <span>Last updated: {dashboardUser.lastUpdated}</span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-star-700" title="Sample dashboard timestamp" aria-label="Sample dashboard timestamp">
          <RefreshCw size={15} aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}
