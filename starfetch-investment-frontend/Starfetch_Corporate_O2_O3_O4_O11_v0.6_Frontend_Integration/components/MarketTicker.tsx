import { Info } from "lucide-react";
import { marketTickerItems } from "./site-data";

export function MarketTicker() {
  return (
    <section aria-label="Market data ticker" className="border-b border-star-200 bg-white py-0">
      <div className="mx-auto flex max-w-7xl items-stretch px-0 lg:px-8">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-max items-stretch divide-x divide-star-200 sm:min-w-0 sm:justify-between">
            {marketTickerItems.map((item) => (
              <div key={item.label} className="flex min-w-[190px] items-center gap-3 px-5 py-3.5 sm:min-w-0 sm:px-4 lg:px-6">
                <span className="h-2 w-2 shrink-0 rounded-full bg-star-lime" aria-hidden="true" />
                <div>
                  <p className="whitespace-nowrap text-[0.66rem] font-bold uppercase tracking-[0.09em] text-star-muted">{item.label}</p>
                  <p className="mt-0.5 text-sm font-bold leading-none text-star-900">
                    {item.value} <span className="font-normal text-star-muted">{item.detail}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <a
          href="#market-data-notice"
          aria-label="Read market data delay notice"
          title="Market data may be delayed"
          className="grid w-12 shrink-0 place-items-center border-l border-star-200 text-star-muted transition hover:bg-star-50 hover:text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700"
        >
          <Info size={17} />
        </a>
      </div>
    </section>
  );
}
