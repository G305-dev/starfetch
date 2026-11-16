import type { PortfolioHolding } from "./admin-portfolios-data";
import type { PortfolioFiltersState } from "./PortfolioFilters";

/** Filters mock holdings only. Maturity ranges are anchored to the synthetic snapshot. */
export function filterPortfolioHoldings(holdings:PortfolioHolding[],filters:PortfolioFiltersState,snapshot:string):PortfolioHolding[] {
  const query=filters.search.trim().toLowerCase();
  const start=new Date(`${snapshot}T00:00:00Z`);const end=new Date(start);
  if(filters.maturity==="30")end.setUTCDate(end.getUTCDate()+30);
  if(filters.maturity==="3m")end.setUTCMonth(end.getUTCMonth()+3);
  if(filters.maturity==="6m")end.setUTCMonth(end.getUTCMonth()+6);
  if(filters.maturity==="12m")end.setUTCMonth(end.getUTCMonth()+12);
  return holdings.filter(item=>{
    const matchesSearch=!query||[item.id,item.name,item.solution].some(value=>value.toLowerCase().includes(query));
    const matchesSolution=filters.solution==="All Solutions"||item.solution===filters.solution;
    const matchesStatus=filters.status==="All Statuses"||item.status===filters.status;
    const maturity=item.maturity?new Date(`${item.maturity}T00:00:00Z`):null;
    const matchesMaturity=filters.maturity==="all"||(maturity!==null&&maturity>=start&&maturity<=end);
    return matchesSearch&&matchesSolution&&matchesStatus&&matchesMaturity;
  });
}
