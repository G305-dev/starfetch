import { Settings2 } from "lucide-react";
import { CorporateVerificationProgress } from "./CorporateVerificationProgress";

/** Corporate settings are read-only until versioned backend edit operations are approved. */
export function BusinessAccountSettingsContent() {
  return (
    <main aria-labelledby="business-account-settings-heading">
      <header><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Corporate account</p><h1 id="business-account-settings-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Account settings</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Settings and profile edits will be available only when a versioned Corporate account API authorises them.</p></header>
      <section className="mt-6 rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-star-100 text-star-700"><Settings2 size={20} aria-hidden="true" /></span><div><h2 className="text-base font-extrabold text-star-900">Changes are unavailable</h2><p className="mt-1 text-sm leading-6 text-star-muted">This portal does not present local edits as saved. No company profile, representative, notification or security change is sent until an approved Corporate mutation operation is available.</p></div></div></section>
      <div className="mt-6"><CorporateVerificationProgress /></div>
    </main>
  );
}
