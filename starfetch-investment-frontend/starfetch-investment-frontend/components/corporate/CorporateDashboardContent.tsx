import { CheckCircle2 } from "lucide-react";
import { CorporateDocumentsCard } from "./CorporateDocumentsCard";
import { CorporateInvestmentTable } from "./CorporateInvestmentTable";
import { CorporateQuickActions } from "./CorporateQuickActions";
import { CorporateRecentActivity } from "./CorporateRecentActivity";
import { CorporateSummaryCards } from "./CorporateSummaryCards";
import { corporateAccountStatus, corporateCompany } from "./corporate-dashboard-data";
import { PortfolioValueChart } from "./PortfolioValueChart";

export function CorporateDashboardContent() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-9 lg:py-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="font-display text-[clamp(1.8rem,3vw,2.45rem)] font-extrabold tracking-[-0.045em] text-star-900">{corporateCompany.greeting}, {corporateCompany.name}</h1><p className="mt-1 text-[1rem] text-star-muted">{corporateCompany.accountLabel}</p></div><section className="inline-flex min-h-[62px] items-center gap-3 rounded-lg border border-star-200 bg-star-50 px-4 py-3" aria-label={corporateAccountStatus.label}><span className="grid h-8 w-8 place-items-center rounded-full bg-star-lime text-star-900" aria-hidden="true"><CheckCircle2 size={18} strokeWidth={2.5} /></span><span className="text-sm font-bold text-star-900">{corporateAccountStatus.label}</span></section></div>
      <div className="mt-6"><CorporateSummaryCards /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.72fr)_320px]"><PortfolioValueChart /><CorporateQuickActions /></div>
      <div className="mt-5"><CorporateInvestmentTable /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_320px]"><CorporateRecentActivity /><CorporateDocumentsCard /></div>
      <div id="company-profile" className="scroll-mt-24" />
      <div id="settings" className="scroll-mt-24" />
    </main>
  );
}
