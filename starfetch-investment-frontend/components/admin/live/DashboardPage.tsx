"use client";
import Link from 'next/link';
import {TrendingUp,ShieldCheck,Users,Clock3} from 'lucide-react';
import {Card,State,Load,Th,Td,useRemote,usePaged} from './UI';
import {money,na,date,type DashboardSummary,type AumPoint,type AllocationRow,type Investor} from '@/lib/admin-api/contracts';
function Metric({label,value,icon:Icon}:{label:string;value:string;icon:typeof Users}){return <Card><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-star-muted">{label}</p><p className="mt-2 text-xl font-extrabold text-star-900">{value}</p></div><span className="rounded-full bg-star-100 p-3 text-star-700"><Icon size={19}/></span></div></Card>}
export function DashboardPage(){
 const summary=useRemote<DashboardSummary>('/dashboard/summary');
 const series=useRemote<{points:AumPoint[]}>('/dashboard/aum-series');
 const allocation=useRemote<{rows:AllocationRow[]}>('/dashboard/allocation');
 const registrations=usePaged<Investor>('/dashboard/recent-registrations',{page:1,pageSize:5});
 const s=summary.value;
 return <div className="space-y-5">
 <section aria-label="Dashboard metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total Investors" value={s?.totalInvestors==null?'Not available':na(s.totalInvestors)} icon={Users}/><Metric label="Verified Investors" value={s?.verifiedInvestors==null?'Not available':na(s.verifiedInvestors)} icon={ShieldCheck}/><Metric label="Total AUM" value={money(s?.totalAumMinor,s?.currency)} icon={TrendingUp}/><Metric label="Pending KYC" value={s?.pendingKycCount==null?'Not available':na(s.pendingKycCount)} icon={Clock3}/></section>
 {summary.status!=='success'&&<Load status={summary.status} error={summary.error} retry={summary.retry}/>}
 <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"><Card><h2 className="font-extrabold text-star-900">AUM Performance</h2><p className="mt-1 text-xs text-star-muted">Backend reported valuation series · {date(s?.asOf)}</p><Load status={series.status} error={series.error} retry={series.retry}/>{series.status==='success'&&<AumChart points={series.value?.points??[]}/>}</Card><Card><h2 className="font-extrabold text-star-900">Asset Allocation</h2><p className="mt-1 text-xs text-star-muted">Authoritative solution breakdown</p><Load status={allocation.status} error={allocation.error} retry={allocation.retry}/>{allocation.status==='success'&&(!allocation.value?.rows?.length?<State status="empty"/>:<div className="mt-5 space-y-4">{allocation.value.rows.map(row=><div key={row.solutionCode??row.investmentSolution}><div className="flex justify-between gap-3 text-xs"><span className="font-bold">{row.investmentSolution}</span><span>{money(row.amountMinor,s?.currency)}</span></div>{typeof row.percentage==='number'&&row.percentage>=0&&row.percentage<=100&&<div className="mt-2 h-2 rounded bg-star-100"><div className="h-2 rounded bg-star-700" style={{width:`${row.percentage}%`}}/></div>}</div>)}</div>)}</Card></div>
 <Card><div className="mb-4 flex items-center justify-between"><h2 className="font-extrabold text-star-900">Recent Registrations</h2><Link className="text-xs font-bold text-star-700 underline" href="/admin/users">View All</Link></div><Load status={registrations.status} error={registrations.error} retry={registrations.retry}/>{registrations.status==='success'&&(registrations.items.length===0?<State status="empty"/>:<div className="overflow-x-auto"><table className="w-full min-w-[650px]"><thead><tr><Th>Investor</Th><Th>Account Type</Th><Th>KYC Status</Th><Th>Registered</Th></tr></thead><tbody className="divide-y divide-star-200">{registrations.items.map(i=><tr key={i.investorId}><Td><div className="font-bold">{i.displayName}</div><span className="text-[11px] text-star-muted">{i.emailMasked??''}</span></Td><Td>{i.accountType}</Td><Td>{na(i.kycStatus)}</Td><Td>{date(i.createdAt)}</Td></tr>)}</tbody></table></div>)}</Card>
 </div>;
}
function AumChart({points}:{points:AumPoint[]}){
 const valid=points.filter(x=>x.valueMinor!==null&&/^-?\d+$/.test(x.valueMinor??''));if(!valid.length)return <State status="empty" message="No authoritative valuation series available."/>;
 const values=valid.map(p=>BigInt(p.valueMinor!));const min=values.reduce((a,b)=>a<b?a:b),max=values.reduce((a,b)=>a>b?a:b),range=max-min||1n;
 const path=values.map((v,i)=>`${i===0?'M':'L'} ${Math.round(i*680/Math.max(1,values.length-1))} ${200-Math.round(Number((v-min)*180n/range))}`).join(' ');
 return <div className="mt-4"><svg viewBox="0 0 700 230" className="h-56 w-full" role="img" aria-label="AUM valuation history from backend"><path d={path} fill="none" stroke="#075038" strokeWidth="4" strokeLinecap="round"/><line x1="0" y1="202" x2="700" y2="202" stroke="#D9EAC8"/></svg><p className="text-xs text-star-muted">{valid.length} reported data points · {date(valid[valid.length-1].asOf)}</p></div>;
}
