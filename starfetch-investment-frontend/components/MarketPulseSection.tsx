import { formatPulseValue, type MarketPulseIndicator, type MarketPulseResult } from "@/lib/market/market-pulse";

/** Separate full-width Market Pulse section, matching the approved three-card reference. */
function PulseCard({ indicator }: { indicator: MarketPulseIndicator }) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl bg-white px-6 py-9 text-center shadow-[0_8px_26px_rgba(0,0,0,0.08)] sm:px-8">
      <p className="font-display text-4xl font-bold tabular-nums text-star-900 sm:text-5xl">
        {formatPulseValue(indicator)}
      </p>
      <h3 className="mt-4 font-display text-lg font-bold text-star-900 sm:text-xl">
        {indicator.label}
      </h3>
      {indicator.note ? (
        <p className="mt-4 flex-1 text-sm leading-7 text-star-muted">{indicator.note}</p>
      ) : (
        <div className="flex-1" />
      )}
      <p className="mt-5 text-xs leading-5 text-star-muted">
        {indicator.reportingPeriod} · {indicator.source}
      </p>
      {indicator.appliesTo ? (
        <p className="mt-1 text-xs text-star-muted">{indicator.appliesTo}</p>
      ) : null}
    </article>
  );
}

export function MarketPulseSection({ pulse }: { pulse: MarketPulseResult }) {
  return (
    <section id="market-pulse" aria-labelledby="market-pulse-heading" className="bg-star-900 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-star-lime">Market Pulse</p>
        <h2 id="market-pulse-heading" className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
          The numbers shaping Nigerian investing
        </h2>
        <p className="mt-5 max-w-4xl text-base leading-7 text-star-100">
          Policy figures we verify against official NBS and CBN publications before publishing.
        </p>

        {pulse.status === "ready" ? (
          <>
            <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-3">
              {pulse.data.indicators.map((indicator) => (
                <PulseCard key={indicator.id} indicator={indicator} />
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-star-100">

              Last verified {pulse.data.lastVerified}.
            </p>
          </>
        ) : (
          <div className="mt-10 rounded-2xl border border-white/20 bg-white/10 p-6">
            <p className="text-lg font-bold text-white">Indicators temporarily unavailable</p>
            <p className="mt-2 text-sm text-star-100">{pulse.note}</p>
          </div>
        )}
      </div>
    </section>
  );
}
