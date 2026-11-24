/**
 * Loading placeholder for the unified market strip.
 *
 * Matches the real strip's height and the marker column's split-feed layout so
 * the hero below does not jump when the data arrives. Contains no numbers.
 */
export function MarketTickerSkeleton() {
  return (
    <section
      aria-label="Nigerian Exchange and global commodity market ticker"
      aria-busy="true"
      className="ngx-market-strip relative z-0 w-full overflow-hidden border-b border-star-200 bg-white"
    >
      <div className="flex min-h-[58px] w-full">
        <div className="z-10 flex w-[150px] shrink-0 flex-col justify-center gap-1 bg-star-900 px-3 py-1.5 sm:w-[230px] sm:px-5">
          <span className="text-[0.55rem] font-extrabold uppercase tracking-[0.13em] text-star-lime">NGX · Commodities</span>
          <span className="block h-1.5 w-16 rounded-full bg-white/15" />
          <span className="block h-1.5 w-16 rounded-full bg-white/15" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-6 overflow-hidden bg-star-900 px-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="flex h-[58px] min-w-[180px] flex-col justify-center gap-2">
              <span className="block h-2.5 w-24 rounded-full bg-white/15" />
              <span className="block h-2 w-16 rounded-full bg-white/10" />
            </span>
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">Loading market data.</p>
    </section>
  );
}
