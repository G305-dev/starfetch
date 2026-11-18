import { CalendarDays, Layers3, ShieldCheck } from "lucide-react";
import type { InvestmentStatus } from "./AdminBadges";
import type { AccountType, AdminStat } from "./admin-dashboard-data";

export type InvestmentSolution = "Starfetch Fixed Note" | "Discretionary Portfolio" | "Execution Mandate";
export interface FundingStage { label: "Initiated" | "Funds Received" | "Invested" | "Matured"; complete: boolean; date?: string }
export interface InvestmentDetail {
  totalReturn: string;
  returnPercent: string;
  expectedYield: string;
  term: string;
  accruedIncome: string;
  multiple: string;
  allocation: { label: string; percentage: string }[];
  funding: FundingStage[];
  notes: string;
  documents: { title: string; date: string; status: string }[];
  activity: { title: string; date: string; description: string }[];
}
export interface AdminInvestment {
  reference: string;
  accountReference: string;
  investor: string;
  email: string;
  solution: InvestmentSolution;
  series?: string;
  accountType: AccountType;
  amountInvested: number;
  currentValue: number;
  status: InvestmentStatus;
  startDate: string;
  maturityDate: string;
  detail: InvestmentDetail;
}
export const investmentSnapshotDate = "2026-11-02";
export const investmentSummaryStats: AdminStat[] = [
  { title: "Total Investments", value: "1,842", change: "+12.6%", icon: Layers3 },
  { title: "Active Products", value: "28", change: "+7.7%", icon: ShieldCheck },
  { title: "Total AUM", value: "₦482.35B", change: "+14.9%", icon: Layers3 },
  { title: "Maturing Soon", value: "136", change: "+23.6%", icon: CalendarDays, changeTone: "warning" },
];
export const investmentTabs = [
  { id: "all", label: "All Investments", aggregate: "1,842" },
  { id: "fixed", label: "Fixed Note", aggregate: "692" },
  { id: "discretionary", label: "Discretionary Portfolio", aggregate: "438" },
  { id: "execution", label: "Execution Mandate", aggregate: "276" },
  { id: "pending", label: "Pending Funding", aggregate: "156" },
] as const;
export type InvestmentTab = (typeof investmentTabs)[number]["id"];

// Fixtures are display-only examples. Values are not derived from amounts, dates, or status.
const exampleDetail: InvestmentDetail = {
  totalReturn: "₦18,750,000 (7.50%)", returnPercent: "7.50%", expectedYield: "15.00%", term: "36 months", accruedIncome: "₦6,250,000", multiple: "1.075x",
  allocation: [{ label: "Starfetch Fixed Note — Series IV", percentage: "100.00%" }],
  funding: [{label:"Initiated",complete:true,date:"Nov 1, 2026"},{label:"Funds Received",complete:true,date:"Nov 2, 2026"},{label:"Invested",complete:true,date:"Nov 2, 2026"},{label:"Matured",complete:false,date:"Nov 2, 2029"}],
  notes: "Synthetic example: Starfetch Fixed Note Series IV at 15.00% p.a. for 36 months. Funds received and deployed on schedule. No exceptions.",
  documents: [{ title: "Investment agreement", date: "Nov 2, 2026", status: "Mock document" }, { title: "Funding confirmation", date: "Nov 2, 2026", status: "Mock document" }],
  activity: [{ title: "Investment recorded", date: "Nov 2, 2026", description: "Synthetic record added." }, { title: "Funds received", date: "Nov 2, 2026", description: "Mock funding status updated." }],
};
// Additional records intentionally contain unavailable values rather than calculated financial figures.
function sampleDetail(solution: InvestmentSolution, funding: FundingStage[]): InvestmentDetail {
  return { totalReturn: "Not available in sample", returnPercent: "—", expectedYield: "—", term: "—", accruedIncome: "—", multiple: "—", allocation: [{ label: solution, percentage: "100.00%" }], funding, notes: "No additional mock internal notes provided.", documents: [], activity: [] };
}
const activeFunding: FundingStage[] = [{label:"Initiated",complete:true},{label:"Funds Received",complete:true},{label:"Invested",complete:true},{label:"Matured",complete:false}];
const reviewFunding: FundingStage[] = [{label:"Initiated",complete:true},{label:"Funds Received",complete:true},{label:"Invested",complete:false},{label:"Matured",complete:false}];
const pendingFunding: FundingStage[] = [{label:"Initiated",complete:true},{label:"Funds Received",complete:false},{label:"Invested",complete:false},{label:"Matured",complete:false}];
const maturedFunding: FundingStage[] = [{label:"Initiated",complete:true},{label:"Funds Received",complete:true},{label:"Invested",complete:true},{label:"Matured",complete:true}];
export const adminInvestments: AdminInvestment[] = [
  { reference:"INV-008473",accountReference:"ACC-100234",investor:"Olamide Adebayo",email:"olamide.adebayo@email.com",solution:"Starfetch Fixed Note",series:"Series IV",accountType:"Individual",amountInvested:250000000,currentValue:268750000,status:"Active",startDate:"2026-11-02",maturityDate:"2029-11-02",detail:exampleDetail },
  { reference:"INV-008472",accountReference:"ACC-100233",investor:"Kehinde Ibrahim",email:"kehinde.ibrahim@email.com",solution:"Discretionary Portfolio",accountType:"Joint",amountInvested:120000000,currentValue:134460000,status:"Under Review",startDate:"2026-10-15",maturityDate:"2031-10-15",detail:sampleDetail("Discretionary Portfolio",reviewFunding) },
  { reference:"INV-008471",accountReference:"ACC-100232",investor:"Bluecrest Capital Ltd",email:"info@bluecrestcap.example",solution:"Execution Mandate",accountType:"Corporate",amountInvested:2000000000,currentValue:2145600000,status:"Active",startDate:"2026-09-01",maturityDate:"2028-09-01",detail:sampleDetail("Execution Mandate",activeFunding) },
  { reference:"INV-008470",accountReference:"ACC-100231",investor:"Aishat Tinubu",email:"aishat.tinubu@email.com",solution:"Starfetch Fixed Note",series:"Series III",accountType:"Individual",amountInvested:75000000,currentValue:79875000,status:"Active",startDate:"2026-08-28",maturityDate:"2028-08-28",detail:sampleDetail("Starfetch Fixed Note",activeFunding) },
  { reference:"INV-008469",accountReference:"ACC-100230",investor:"Emeka Okafor",email:"emeka.okafor@email.com",solution:"Discretionary Portfolio",accountType:"Individual",amountInvested:300000000,currentValue:322950000,status:"Pending Funding",startDate:"2026-11-01",maturityDate:"2031-11-01",detail:sampleDetail("Discretionary Portfolio",pendingFunding) },
  { reference:"INV-008468",accountReference:"ACC-100229",investor:"Sola Musa",email:"sola.musa@example.com",solution:"Execution Mandate",accountType:"Corporate",amountInvested:500000000,currentValue:515000000,status:"Active",startDate:"2026-07-14",maturityDate:"2029-07-14",detail:sampleDetail("Execution Mandate",activeFunding) },
  { reference:"INV-008467",accountReference:"ACC-100228",investor:"Greenfields Holdings Ltd",email:"admin@greenfields.example",solution:"Starfetch Fixed Note",series:"Series IV",accountType:"Corporate",amountInvested:1250000000,currentValue:1307500000,status:"Under Review",startDate:"2026-10-31",maturityDate:"2030-10-31",detail:sampleDetail("Starfetch Fixed Note",reviewFunding) },
  { reference:"INV-008466",accountReference:"ACC-100227",investor:"Adesola Ojo",email:"adesola.ojo@example.com",solution:"Discretionary Portfolio",accountType:"Individual",amountInvested:50000000,currentValue:47250000,status:"Matured",startDate:"2024-04-10",maturityDate:"2026-04-10",detail:sampleDetail("Discretionary Portfolio",maturedFunding) },
  { reference:"INV-008465",accountReference:"ACC-100226",investor:"Rivermere Foods Ltd",email:"finance@rivermere.example",solution:"Execution Mandate",accountType:"Corporate",amountInvested:800000000,currentValue:872000000,status:"Active",startDate:"2026-05-05",maturityDate:"2029-05-05",detail:sampleDetail("Execution Mandate",activeFunding) },
  { reference:"INV-008464",accountReference:"ACC-100225",investor:"Bisi Adekunle",email:"bisi.adekunle@example.com",solution:"Starfetch Fixed Note",series:"Series III",accountType:"Joint",amountInvested:100000000,currentValue:106400000,status:"Pending Funding",startDate:"2026-10-20",maturityDate:"2028-10-20",detail:sampleDetail("Starfetch Fixed Note",pendingFunding) },
  { reference:"INV-008463",accountReference:"ACC-100224",investor:"Ada Nwosu",email:"ada.nwosu@example.com",solution:"Execution Mandate",accountType:"Individual",amountInvested:25000000,currentValue:26000000,status:"Closed",startDate:"2025-07-01",maturityDate:"2026-07-01",detail:sampleDetail("Execution Mandate",maturedFunding) },
  { reference:"INV-008462",accountReference:"ACC-100223",investor:"Ife and Tunde Bello",email:"bello@example.com",solution:"Discretionary Portfolio",accountType:"Joint",amountInvested:40000000,currentValue:42000000,status:"Active",startDate:"2026-06-15",maturityDate:"2029-06-15",detail:sampleDetail("Discretionary Portfolio",activeFunding) },
];
export function investmentLabel(investment: AdminInvestment) { return investment.series ? `${investment.solution} — ${investment.series}` : investment.solution; }
