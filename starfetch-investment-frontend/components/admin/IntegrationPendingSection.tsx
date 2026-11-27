import { ClockAlert, Lock, ServerOff } from "lucide-react";
import type { ReactNode } from "react";

/**
 * INTEGRATION-PENDING SECTION SHELL.
 *
 * Eleven of the eighteen sections have no approved backend contract yet. They
 * still need to exist, because staff should be able to see the shape of the
 * portal and because the brief asks for the frontend to be prepared — but they
 * must not pretend to work.
 *
 * This component renders the honest state:
 *
 *  - Every action is described but DISABLED, with the reason stated.
 *  - No placeholder rows, no sample figures, no fake balances. An empty table
 *    with invented data is worse than no table: it teaches staff to distrust the
 *    portal and makes a screenshot indistinguishable from a working system.
 *  - The required backend contract is named, so David can work from it.
 *
 * It deliberately reuses the existing card, typography and colour tokens so it
 * looks like the rest of the portal rather than like an error page.
 */
export type PendingCapability = {
  /** What staff will be able to do. */
  label: string;
  /** Why it cannot work yet — the exact backend dependency. */
  blockedBy: string;
};

export function IntegrationPendingSection({
  title,
  summary,
  capabilities,
  children,
}: {
  title: string;
  summary: string;
  capabilities: PendingCapability[];
  /** Optional extra content rendered under the capability list. */
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#e7ece7] bg-white p-4 shadow-[0_3px_12px_rgba(23,51,30,0.035)] sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
            <ClockAlert size={12} aria-hidden="true" />
            Integration pending
          </span>
        </div>
        <h2 className="mt-3 text-lg font-extrabold text-star-900">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-star-muted">{summary}</p>

        <p className="mt-4 rounded-lg border border-star-200 bg-star-50 p-3 text-xs leading-5 text-star-900">
          <strong className="font-extrabold">This section cannot perform work yet.</strong>{" "}
          The frontend is prepared, but the backend contract below has not been approved or implemented.
          No records are shown and no figures are calculated here — the portal does not invent
          financial data. Nothing on this page is a real investor record.
        </p>
      </section>

      <section
        className="rounded-xl border border-[#e7ece7] bg-white p-4 shadow-[0_3px_12px_rgba(23,51,30,0.035)] sm:p-5"
        aria-labelledby="pending-capabilities-heading"
      >
        <h3 id="pending-capabilities-heading" className="text-sm font-extrabold text-star-900">
          Planned capabilities and what each one is waiting for
        </h3>
        <ul className="mt-3 divide-y divide-star-200">
          {capabilities.map((capability) => (
            <li key={capability.label} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3">
              <Lock size={14} className="mt-0.5 shrink-0 text-star-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-xs font-bold text-star-900">{capability.label}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#f4f8f3] px-2 py-0.5 text-[10px] font-semibold text-star-muted">
                <ServerOff size={10} aria-hidden="true" />
                {capability.blockedBy}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-5 text-star-muted">
          Every action in this list is disabled in the interface. Disabling it is a usability
          measure, not a security control — the backend must independently authorize each
          operation when these contracts are implemented.
        </p>
      </section>

      {children}
    </div>
  );
}
