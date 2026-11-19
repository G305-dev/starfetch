"use client";
import {money,date,type PortfolioSummary} from '@/lib/admin-api/contracts';
import {Card,Load,State,Th,Td,useRemote} from './UI';
export function PortfolioPage(){
 const result=useRemote<PortfolioSummary>('/portfolios/by-solution');
 return <Card><h2 className="text-base font-extrabold text-star-900">Portfolio Overview</h2><p className="mt-1 text-xs text-star-muted">Authoritative investment-solution valuation · As of {date(result.value?.asOf)} · Status: {result.value?.valuationStatus??'Not available'}</p><div className="mt-4"><Load status={result.status} error={result.error} retry={result.retry}/>{result.status==='success'&&(!result.value?.rows?.length?<State status="empty"/>:<div className="overflow-x-auto rounded-lg border border-star-200"><table className="w-full min-w-[520px] text-left"><thead><tr><Th>Investment Solution</Th><Th className="text-right">Amount Invested</Th><Th className="text-right">Current Value</Th></tr></thead><tbody className="divide-y divide-star-200">{result.value.rows.map(x=><tr key={x.solutionCode}><Td>{x.investmentSolution}</Td><Td className="text-right tabular-nums">{money(x.amountInvestedMinor,result.value?.currency)}</Td><Td className="text-right tabular-nums">{money(x.currentValueMinor,result.value?.currency)}</Td></tr>)}</tbody></table></div>)}</div></Card>;
}
