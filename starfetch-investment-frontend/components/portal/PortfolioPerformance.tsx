import { ChevronDown, RefreshCw, TrendingUp } from "lucide-react";
import { portfolioChartData } from "./dashboard-data";

const chartWidth = 760;
const chartHeight = 275;
const chartPadding = { top: 18, right: 14, bottom: 42, left: 44 };
const maximumValue = 15;
const chartAreaWidth = chartWidth - chartPadding.left - chartPadding.right;
const chartAreaHeight = chartHeight - chartPadding.top - chartPadding.bottom;

function pointFor(value: number, index: number) {
  const x = chartPadding.left + (chartAreaWidth / (portfolioChartData.length - 1)) * index;
  const y = chartPadding.top + chartAreaHeight - (value / maximumValue) * chartAreaHeight;
  return { x, y };
}

const chartPoints = portfolioChartData.map(({ value }, index) => pointFor(value, index));
const linePoints = chartPoints.map(({ x, y }) => `${x},${y}`).join(" ");
const areaPath = `M ${chartPoints[0].x},${chartPadding.top + chartAreaHeight} L ${chartPoints.map(({ x, y }) => `${x},${y}`).join(" L ")} L ${chartPoints[chartPoints.length - 1].x},${chartPadding.top + chartAreaHeight} Z`;
const yAxisLabels = [15, 12, 9, 6, 3, 0];

export function PortfolioPerformance() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="portfolio-performance-heading">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="portfolio-performance-heading" className="text-lg font-extrabold text-star-900">Portfolio Performance</h2>
          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-[clamp(1.65rem,3vw,2.25rem)] font-extrabold leading-none tracking-[-0.05em] text-star-900">₦12,500,000</p>
            <span className="inline-flex items-center gap-1 text-sm font-extrabold text-[#22953d]"><TrendingUp size={17} aria-hidden="true" />8.4%</span>
          </div>
          <p className="mt-2 text-sm text-star-muted">Total portfolio value</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-between gap-6 rounded-lg border border-star-200 bg-white px-3.5 text-sm font-bold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          aria-label="Last 6 Months range selector is unavailable in this dashboard mockup"
        >
          Last 6 Months <ChevronDown size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-6">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-auto w-full" role="img" aria-labelledby="portfolio-chart-title portfolio-chart-description">
          <title id="portfolio-chart-title">Sample portfolio performance from April to October 2026</title>
          <desc id="portfolio-chart-description">Illustrative portfolio values rise from 2.5 million naira in April to 12.5 million naira in October 2026.</desc>
          <defs>
            <linearGradient id="portfolio-area-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#B9ED1D" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#B9ED1D" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          {yAxisLabels.map((label) => {
            const y = chartPadding.top + chartAreaHeight - (label / maximumValue) * chartAreaHeight;
            return (
              <g key={label}>
                <line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke="#D9EAC8" strokeWidth="1" />
                <text x="0" y={y + 4} fill="#607668" fontSize="11">{label === 0 ? "0" : `${label}M`}</text>
              </g>
            );
          })}
          {portfolioChartData.map(({ month }, index) => {
            const point = chartPoints[index];
            return <text key={month} x={point.x} y={chartHeight - 12} textAnchor="middle" fill="#607668" fontSize="10.5">{month.replace(" 2026", "")}</text>;
          })}
          <path d={areaPath} fill="url(#portfolio-area-fill)" />
          <polyline points={linePoints} fill="none" stroke="#16842F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {chartPoints.map(({ x, y }, index) => <circle key={portfolioChartData[index].month} cx={x} cy={y} r="4.5" fill="#16842F" stroke="#fff" strokeWidth="2" />)}
        </svg>
      </div>
      <p className="sr-only">This chart uses sample portfolio data only and does not represent live investment performance.</p>
      <div className="mt-1 flex items-center justify-end gap-1.5 text-[0.68rem] text-star-muted">
        <RefreshCw size={12} aria-hidden="true" /> Sample data
      </div>
    </section>
  );
}
