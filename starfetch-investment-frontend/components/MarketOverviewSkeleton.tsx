/**
 * Loading state for Market at a Glance.
 *
 * Used as the Suspense fallback around the market section. It reproduces the
 * single full-width equities card and the separate three-card Market Pulse
 * section so the section does not shift when the real content arrives — a
 * loading state "without disrupting the homepage layout" means matching the final
 * geometry, not showing a spinner that collapses to nothing.
 *
 * V4: the commodities card was removed from the landing page, so the skeleton now
 * reserves ONE card rather than two. Leaving the second block in place would have
 * reproduced exactly the empty gap the removal was meant to eliminate.
 *
 * Deliberately contains NO numbers and no percentages: a placeholder that looks
 * like a price is the exact failure this delivery is guarding against.
 */

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-star-200 bg-white shadow-[0_4px_18px_rgba(0,59,42,0.04)]">
      {children}
    </article>
  );
}

/** A neutral bar standing in for text. Never shaped like a number. */
function Bar({ w, h = "h-2.5" }: { w: string; h?: string }) {
  return <span className={`block ${h} ${w} rounded-full bg-star-100`} />;
}

export function MarketOverviewSkeleton() {
  return (
    <>
    <section id="ngx-markets" className="bg-white py-16 sm:py-20 lg:py-24" aria-busy="true">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <Bar w="w-20" h="h-2" />
          <span className="mt-3 block h-8 w-64 rounded-lg bg-star-100" />
          <span className="mt-3 block h-3 w-full max-w-xl rounded-full bg-star-100" />
        </div>

        <div className="mt-10">
          {[0].map((card) => (
            <CardShell key={card}>
              {/* Header matches the real card's icon + two-line title block. */}
              <div className="flex items-center gap-3 border-b border-star-200 px-5 py-4">
                <span className="size-10 shrink-0 rounded-full bg-star-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bar w="w-28" h="h-3" />
                  <Bar w="w-20" h="h-2" />
                </div>
              </div>
              <div className="space-y-3 px-5 py-4">
                {Array.from({ length: 5 }).map((_, row) => (
                  <div key={row} className="flex items-center gap-3">
                    <Bar w="w-20" h="h-3" />
                    <Bar w="w-full" h="h-2" />
                    <Bar w="w-16" h="h-3" />
                  </div>
                ))}
              </div>
              <div className="border-t border-star-100 px-5 py-3.5">
                <Bar w="w-32" h="h-2" />
              </div>
            </CardShell>
          ))}
        </div>

        <p className="sr-only" role="status">Loading market data.</p>
      </div>
    </section>
    <section className="bg-star-900 py-16 sm:py-20" aria-busy="true">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <span className="block h-2 w-28 rounded-full bg-star-lime/40" />
        <span className="mt-5 block h-9 w-full max-w-2xl rounded-lg bg-white/15" />
        <span className="mt-4 block h-3 w-full max-w-xl rounded-full bg-white/10" />
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <CardShell key={item}>
              <div className="space-y-5 px-6 py-9">
                <span className="mx-auto block h-10 w-32 rounded-lg bg-star-100" />
                <span className="mx-auto block h-5 w-36 rounded-full bg-star-100" />
                <span className="mx-auto block h-3 w-full max-w-xs rounded-full bg-star-100" />
                <span className="mx-auto block h-3 w-3/4 rounded-full bg-star-100" />
              </div>
            </CardShell>
          ))}
        </div>
      </div>
    </section>
    </>
  );
}
