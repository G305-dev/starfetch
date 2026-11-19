"use client";
import { useState, type FormEvent } from "react";
import { DemoModal, demoButton } from "./DemoModal";
import { DemoInvestorPicker } from "./DemoInvestorPicker";
import { USER_NOT_FOUND, accountReferenceForUser, getDemoUser, useDemoUsers } from "./demo-user-registry";
import { formatMockMoney, type AdminUser } from "./fixtures/admin-users-data";
import type { AdminInvestment, InvestmentSolution } from "./fixtures/admin-investments-data";
import type { InvestmentStatus } from "./AdminBadges";

const control = "mt-1.5 min-h-10 w-full rounded-md border border-[#d8e2d8] bg-white px-3 py-2 text-sm text-star-900 outline-none focus:ring-2 focus:ring-star-700";
const solutions: InvestmentSolution[] = ["Starfetch Fixed Note", "Discretionary Portfolio", "Execution Mandate"];
const statuses: InvestmentStatus[] = ["Pending Funding", "Under Review", "Active", "Matured", "Closed"];
function validDate(value:string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const d=new Date(`${value}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value; }
function validAmount(value:string) { return /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 1_000_000_000_000; }
export function buildDemoInvestment(user: AdminUser, fields: {reference:string;solution:InvestmentSolution;amount:number;value:number;status:InvestmentStatus;start:string;maturity:string;yieldPercent:string;term:string;notes:string}): AdminInvestment {
  const gain = fields.value - fields.amount;
  const percent = fields.amount ? 100 * gain / fields.amount : 0;
  return {
    reference:fields.reference, investorReference:user.reference, accountReference:accountReferenceForUser(user), investor:user.name,email:user.email,accountType:user.accountType,
    solution:fields.solution, amountInvested:fields.amount,currentValue:fields.value,status:fields.status,startDate:fields.start,maturityDate:fields.maturity,
    detail:{totalReturn:formatMockMoney(gain),returnPercent:`${percent.toFixed(2)}%`,expectedYield:fields.yieldPercent ? `${Number(fields.yieldPercent).toFixed(2)}%` : "Not specified",term:fields.term,accruedIncome:"Not available in demo",multiple:`${(fields.value/fields.amount).toFixed(3)}x`,allocation:[{label:fields.solution,percentage:"100.00%"}],funding:[{label:"Initiated",complete:true,date:fields.start},{label:"Funds Received",complete:false},{label:"Invested",complete:false},{label:"Matured",complete:false}],notes:fields.notes || "No additional mock notes provided.",documents:[],activity:[]}
  };
}
export function AddInvestmentDialog({trigger,close,nextReference,save}:{trigger:HTMLElement|null;close:()=>void;nextReference:string;save:(item:AdminInvestment)=>void}) {
  const users=useDemoUsers();
  const [query,setQuery]=useState(""); const [reference,setReference]=useState("");
  const [solution,setSolution]=useState<InvestmentSolution>("Starfetch Fixed Note");
  const [amount,setAmount]=useState("");const [value,setValue]=useState(""); const [valueTouched,setValueTouched]=useState(false);
  const [status,setStatus]=useState<InvestmentStatus>("Pending Funding");
  const [start,setStart]=useState("2026-11-02");const [maturity,setMaturity]=useState("");
  const [yieldPercent,setYieldPercent]=useState("");const [term,setTerm]=useState("");const [notes,setNotes]=useState("");
  const [error,setError]=useState("");const [userError,setUserError]=useState("");
  const selected=users.find(u=>u.reference===reference);
  function onSubmit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError("");setUserError("");
    // Validate with the latest registry snapshot, not only the rendered selection.
    const user=getDemoUser(reference);
    if (!user) {setUserError(USER_NOT_FOUND);return;}
    if (!validAmount(amount)||!validAmount(value)) {setError("Enter positive NGN amounts up to ₦1 trillion, using at most two decimal places.");return;}
    if (!validDate(start)||!validDate(maturity)||maturity<start) {setError("Enter valid dates; the maturity date must not be before the start date.");return;}
    if (!term.trim()) {setError("Enter the investment term (for example, 36 months).");return;}
    if (yieldPercent && (!/^\d+(?:\.\d{1,2})?$/.test(yieldPercent)||Number(yieldPercent)>100)) {setError("Expected annual yield must be a percentage between 0 and 100.");return;}
    save(buildDemoInvestment(user,{reference:nextReference,solution,amount:Number(amount),value:Number(value),status,start,maturity,yieldPercent,term:term.trim(),notes:notes.trim()}));
  }
  return <DemoModal title="Add Investment" trigger={trigger} onClose={close}>
    <p className="mb-4 text-xs text-[#6a7b6f]">Synthetic demo only. Select a registered demo user. This does not fund, book or approve an actual investment. Do not enter real customer information.</p>
    <form onSubmit={onSubmit} noValidate><div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-bold text-[#38513e]">Investment Reference<input readOnly value={nextReference} className={`${control} bg-[#f3f6f2]`}/></label>
      <div className="hidden sm:block" aria-hidden="true"/>
      <DemoInvestorPicker users={users} query={query} selectedReference={reference} onQueryChange={text=>{setQuery(text);setReference("");setUserError("");}} onSelect={ref=>{setReference(ref);setUserError("");}} error={userError}/>
      <label className="text-xs font-bold text-[#38513e]">Investor Email<input readOnly value={selected?.email ?? ""} className={`${control} bg-[#f3f6f2]`}/></label>
      <label className="text-xs font-bold text-[#38513e]">Account Reference<input readOnly value={selected?accountReferenceForUser(selected):""} className={`${control} bg-[#f3f6f2]`}/></label>
      <label className="text-xs font-bold text-[#38513e]">Account Type<input readOnly value={selected?.accountType ?? ""} className={`${control} bg-[#f3f6f2]`}/></label>
      <label className="text-xs font-bold text-[#38513e]">Investment Solution<select value={solution} onChange={e=>setSolution(e.target.value as InvestmentSolution)} className={control}>{solutions.map(item=><option key={item}>{item}</option>)}</select></label>
      <label className="text-xs font-bold text-[#38513e]">Amount Invested (₦) *<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>{setAmount(e.target.value);if(!valueTouched)setValue(e.target.value);}} className={control}/></label>
      <label className="text-xs font-bold text-[#38513e]">Current Value (₦) *<input type="number" min="0.01" step="0.01" value={value} onChange={e=>{setValueTouched(true);setValue(e.target.value);}} className={control}/></label>
      <label className="text-xs font-bold text-[#38513e]">Investment Status<select value={status} onChange={e=>setStatus(e.target.value as InvestmentStatus)} className={control}>{statuses.map(item=><option key={item}>{item}</option>)}</select></label>
      <label className="text-xs font-bold text-[#38513e]">Start Date *<input type="date" value={start} onChange={e=>setStart(e.target.value)} className={control}/></label>
      <label className="text-xs font-bold text-[#38513e]">Maturity Date *<input type="date" value={maturity} onChange={e=>setMaturity(e.target.value)} className={control}/></label>
      <label className="text-xs font-bold text-[#38513e]">Expected Yield (% p.a., optional)<input type="number" min="0" max="100" step="0.01" value={yieldPercent} onChange={e=>setYieldPercent(e.target.value)} className={control}/></label>
      <label className="text-xs font-bold text-[#38513e]">Investment Term *<input maxLength={80} value={term} onChange={e=>setTerm(e.target.value)} placeholder="e.g. 36 months" className={control}/></label>
      <label className="text-xs font-bold text-[#38513e] sm:col-span-2">Investment Purpose / Notes (optional)<textarea rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} className={control}/></label>
    </div>{error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={close} className={`${demoButton} border border-star-200 text-star-900`}>Cancel</button><button type="submit" className={`${demoButton} bg-star-900 text-white`}>Save Investment</button></div>
    </form>
  </DemoModal>;
}
