import { TradingViewWidget } from "./TradingViewWidget";

const tickerTapeConfiguration = {
  colorTheme: "light",
  displayMode: "adaptive",
  isTransparent: true,
  locale: "en",
  showSymbolLogo: true,
  symbols: [
    { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
    { proName: "FOREXCOM:NSXUSD", title: "NASDAQ 100" },
    { proName: "FOREXCOM:DJI", title: "Dow Jones" },
    { proName: "FX:EURUSD", title: "EUR/USD" },
    { proName: "TVC:GOLD", title: "Gold" },
    { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
    { proName: "BITSTAMP:ETHUSD", title: "Ethereum" },
  ],
};

/** Official TradingView ticker tape; movement and market values are widget-native. */
export function MarketTicker() {
  return (
    <section aria-label="Live global market ticker" className="relative z-0 w-full overflow-hidden border-b border-star-200 bg-white">
      <TradingViewWidget
        ariaLabel="TradingView live global market ticker"
        className="h-14 w-full"
        configuration={tickerTapeConfiguration}
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
      />
    </section>
  );
}
