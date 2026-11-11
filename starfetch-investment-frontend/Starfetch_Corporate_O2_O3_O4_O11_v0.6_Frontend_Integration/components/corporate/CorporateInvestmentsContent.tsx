import { BriefcaseBusiness, LockKeyhole } from "lucide-react";
import Link from "next/link";

export function CorporateInvestmentsContent() {
  return (
    <main aria-labelledby="corporate-investments-heading">
      <header><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Corporate portfolio</p><h1 id="corporate-investments-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Investments</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Corporate investment records will be displayed only from an approved account-specific backend response.</p></header>
      <section className="mt-6 rounded-xl border border-star-200 bg-white p-6 text-center shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-8"><span className="mx-auto grid size-12 place-items-center rounded-full bg-star-100 text-star-700"><BriefcaseBusiness size={24} aria-hidden="true" /></span><h2 className="mt-4 text-xl font-extrabold text-star-900">Investment records unavailable</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-star-muted">No Corporate portfolio or holdings endpoint has been approved for this portal. No example investments, values, returns or performance data are shown.</p><button type="button" disabled className="mt-5 inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-star-100 px-4 text-sm font-extrabold text-star-muted"><LockKeyhole size={16} aria-hidden="true" />Create investment unavailable</button><p className="mt-4 text-xs leading-5 text-star-muted">Investment creation and funding remain restricted until backend authorisation is confirmed.</p><Link href="/corporate/dashboard#verification" className="mt-5 inline-flex text-sm font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3 hover:text-star-900">Review verification progress</Link></section>
    </main>
  );
}
