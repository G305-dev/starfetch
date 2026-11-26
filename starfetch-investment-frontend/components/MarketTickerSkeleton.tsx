/**
 * Loading placeholder for the equities market strip.
 *
 * Matches the real strip's height so the hero below does not jump when the data
 * arrives. Contains no numbers.
 *
 * V5: the fixed dark-green marker block was removed from the real strip, so it is
 * removed here too. A skeleton that still reserved that column would reserve space
 * the live strip no longer uses, and the layout would shift sideways at hydration —
 * the exact thing a skeleton exists to prevent.
 */
export function MarketTickerSkeleton() {
  return (
    <section
      aria-label="Nigerian and international stock market ticker"
      aria-busy="true"
      className="ngx-market-strip relative z-0 w-full overflow-hidden border-b border-star-200 bg-white"
    >
      <div className="flex min-h-[58px] w-full items-center gap-6 overflow-hidden bg-white px-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className="flex h-[58px] min-w-[180px] flex-col justify-center gap-2">
            <span className="block h-2.5 w-24 rounded-full bg-star-100" />
            <span className="block h-2 w-16 rounded-full bg-star-100" />
          </span>
        ))}
      </div>
      <p className="sr-only" role="status">Loading market data.</p>
    </section>
  );
}
