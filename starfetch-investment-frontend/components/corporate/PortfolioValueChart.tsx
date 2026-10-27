import { ChevronDown } from "lucide-react";
import { corporatePortfolioSeries } from "./corporate-dashboard-data";

const chartWidth = 760;
const chartHeight = 238;
const plot = { left: 76, right: 20, top: 18, bottom: 42 };
const minValue = 20000000;
const maxValue = 28000000;
const yTicks = [28000000, 26000000, 24000000, 22000000, 20000000];

function formatNaira(value: number) {
  return `₦${(value / 1000000).toFixed(0)},000,000`;
}

export function PortfolioValueChart() {
  const plotWidth = chartWidth - plot.left - plot.right;
  const plotHeight = chartHeight - plot.top - plot.bottom;
  const points = corporatePortfolioSeries.map((item, index) => ({
    ...item,
    x: plot.left + (plotWidth / (corporatePortfolioSeries.length - 1)) * index,
    y: plot.top + ((maxValue - item.value) / (maxValue - minValue)) * plotHeight,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${chartHeight - plot.bottom} L ${points[0].x.toFixed(2)} ${chartHeight - plot.bottom} Z`;

  return (
    <section className="rounded-lg border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="portfolio-value-heading">
      <div className="flex items-center justify-between gap-4"><h2 id="portfolio-value-heading" className="text-lg font-extrabold text-star-900">Portfolio Value</h2><button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-md border border-star-200 bg-white px-3 text-xs font-bold text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">6 months <ChevronDown size={15} aria-hidden="true" /></button></div>
      <div className="mt-5"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Portfolio value has grown gradually from January to June 2024" className="h-auto w-full text-star-muted"><defs><linearGradient id="corporate-portfolio-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#B7D7A4" stopOpacity="0.62" /><stop offset="100%" stopColor="#EDF6DE" stopOpacity="0.1" /></linearGradient></defs>{yTicks.map((value) => { const y = plot.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight; return <g key={value}><line x1={plot.left} x2={chartWidth - plot.right} y1={y} y2={y} stroke="#D9EAC8" strokeWidth="1" /><text x="0" y={y + 4} fontSize="11" fill="#607668">{formatNaira(value)}</text></g>; })}{points.map((point) => <line key={point.label} x1={point.x} x2={point.x} y1={plot.top} y2={chartHeight - plot.bottom} stroke="#EDF6DE" strokeWidth="1" />)}<path d={areaPath} fill="url(#corporate-portfolio-fill)" /><path d={linePath} fill="none" stroke="#075038" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point) => <g key={`${point.label}-point`}><circle cx={point.x} cy={point.y} r="4" fill="#075038" /><text x={point.x} y={chartHeight - 14} textAnchor="middle" fontSize="11" fill="#607668">{point.label}</text></g>)}</svg></div>
    </section>
  );
}
