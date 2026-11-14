import { ArrowLeftRight, ChartNoAxesColumnIncreasing, FileText, Layers3, Percent, Plus, RefreshCw, TrendingUp, WalletCards, type LucideIcon } from "lucide-react";
import type { AccountType, AdminStat } from "./admin-dashboard-data";
import type { PortfolioStatus } from "./AdminBadges";
import type { InvestmentSolution } from "./admin-investments-data";

export interface PortfolioHolding { id: string; name: string; solution: InvestmentSolution; amountInvested: number; currentValue: number; returnLabel: string; maturity: string | null; status: PortfolioStatus }
export interface PortfolioSolutionSummary { solution: InvestmentSolution; positions: string; invested: string; current: string; returnLabel: string; percentage: string }
export interface PortfolioInvestorSummary { type: AccountType; investors: string; value: string; positions: string; percentage: string }
export interface PortfolioMaturity { reference: string; investor: string; solution: InvestmentSolution; value: string; maturity: string; daysRemaining: string; status: PortfolioStatus }
export interface PortfolioActivity { title: string; description: string; time: string; icon: LucideIcon }
export interface PortfolioChartSeries { label: string; points: number[]; labels: string[] }
export const portfolioSnapshotDate = "2026-11-02";
export const portfolioSummaryStats: AdminStat[] = [
  { title:"Total Portfolio Value", value:"₦4,860,000,000", change:"+6.7%", icon:WalletCards },
  { title:"Active Portfolios", value:"1,247", change:"+8.4%", icon:Layers3 },
  { title:"Investment Positions", value:"3,982", change:"+12.4%", icon:ChartNoAxesColumnIncreasing },
  { title:"YTD Portfolio Return", value:"+9.82%", change:"", icon:Percent, valueDescription:"Weighted average return" },
];
// Display-only values in billions. These fixtures are not valuations or computed performance.
export const portfolioPerformanceData = {
  "30d": { label:"Last 30 Days", points:[4.30,4.36,4.34,4.46,4.45,4.55,4.53,4.63,4.60,4.72,4.77,4.86], labels:["Oct 3","Oct 9","Oct 15","Oct 21","Oct 27","Nov 2"] },
  "3m": { label:"Last 3 Months", points:[3.85,3.98,4.05,4.02,4.18,4.30,4.27,4.44,4.50,4.60,4.70,4.86], labels:["Aug 2026","Aug 2026","Sep 2026","Sep 2026","Oct 2026","Nov 2026"] },
  "6m": { label:"Last 6 Months", points:[3.20,3.25,3.45,3.52,3.88,3.73,3.80,4.05,4.14,4.35,4.22,4.43,4.46,4.63,4.59,4.74,4.70,4.86], labels:["May 2026","Jun 2026","Jul 2026","Aug 2026","Sep 2026","Oct 2026"] },
  ytd: { label:"YTD", points:[3.12,3.18,3.27,3.40,3.55,3.52,3.76,3.85,4.01,4.09,4.22,4.38,4.45,4.56,4.68,4.86], labels:["Jan 2026","Mar 2026","May 2026","Jul 2026","Sep 2026","Nov 2026"] },
  "12m": { label:"Last 12 Months", points:[3.05,3.14,3.24,3.35,3.33,3.52,3.68,3.81,3.95,4.05,4.18,4.30,4.45,4.55,4.73,4.86], labels:["Nov 2025","Jan 2026","Mar 2026","May 2026","Jul 2026","Oct 2026"] },
  all: { label:"All Time", points:[3.03,3.12,3.20,3.30,3.38,3.52,3.68,3.77,3.89,4.05,4.15,4.29,4.44,4.58,4.72,4.86], labels:["2023","2024","2025","Mar 2026","Jul 2026","Oct 2026"] },
} satisfies Record<string, PortfolioChartSeries>;
export type PortfolioPeriod = keyof typeof portfolioPerformanceData;
export const portfolioAllocation = [
  { name:"Starfetch Fixed Note", percent:"52%", color:"#08782b" },
  { name:"Discretionary Portfolio", percent:"32%", color:"#55b72d" },
  { name:"Execution Mandate", percent:"16%", color:"#b9ed1d" },
];
// Descriptive holding labels are synthetic positions, not extra Starfetch solutions.
export const portfolioHoldings: PortfolioHolding[] = [
  {id:"SFN-001",name:"Starfetch Fixed Note",solution:"Starfetch Fixed Note",amountInvested:1500000000,currentValue:1612500000,returnLabel:"+7.50%",maturity:"2027-06-30",status:"Active"},
  {id:"DP-014",name:"Mixed Income Portfolio",solution:"Discretionary Portfolio",amountInvested:980000000,currentValue:1068200000,returnLabel:"+9.00%",maturity:null,status:"Active"},
  {id:"EM-007",name:"Equity Execution Mandate",solution:"Execution Mandate",amountInvested:780000000,currentValue:804600000,returnLabel:"+3.15%",maturity:null,status:"Active"},
  {id:"SFN-003",name:"Starfetch Fixed Note",solution:"Starfetch Fixed Note",amountInvested:600000000,currentValue:645000000,returnLabel:"+7.50%",maturity:"2026-12-15",status:"Active"},
  {id:"DP-009",name:"Balanced Growth Portfolio",solution:"Discretionary Portfolio",amountInvested:500000000,currentValue:545000000,returnLabel:"+9.00%",maturity:null,status:"Active"},
  {id:"SFN-004",name:"Starfetch Fixed Note",solution:"Starfetch Fixed Note",amountInvested:100000000,currentValue:107500000,returnLabel:"+7.50%",maturity:"2026-11-20",status:"Maturing Soon"},
  {id:"SFN-005",name:"Starfetch Fixed Note",solution:"Starfetch Fixed Note",amountInvested:50000000,currentValue:53750000,returnLabel:"+7.50%",maturity:"2026-10-15",status:"Matured"},
  {id:"EM-008",name:"Execution Mandate holding",solution:"Execution Mandate",amountInvested:40000000,currentValue:41000000,returnLabel:"+2.50%",maturity:"2026-09-10",status:"Closed"},
];
export const portfolioBySolution: PortfolioSolutionSummary[] = [
  {solution:"Starfetch Fixed Note",positions:"1,820",invested:"₦2.31B",current:"₦2.53B",returnLabel:"+7.50%",percentage:"52%"},
  {solution:"Discretionary Portfolio",positions:"1,362",invested:"₦1.42B",current:"₦1.56B",returnLabel:"+9.00%",percentage:"32%"},
  {solution:"Execution Mandate",positions:"800",invested:"₦0.73B",current:"₦0.77B",returnLabel:"+3.15%",percentage:"16%"},
];
export const portfolioByInvestorType: PortfolioInvestorSummary[] = [
  {type:"Individual",investors:"865",value:"₦2.20B",positions:"1,950",percentage:"45%"},
  {type:"Joint",investors:"154",value:"₦0.71B",positions:"412",percentage:"15%"},
  {type:"Corporate",investors:"228",value:"₦1.95B",positions:"1,620",percentage:"40%"},
];
export const portfolioPerformanceMetrics = [
  {label:"Total Return",value:"+12.48%"},{label:"YTD Return",value:"+9.82%"},{label:"Monthly Return",value:"+1.20%"},
  {label:"Best Performing Solution",value:"Discretionary Portfolio"},{label:"Lowest Performing Solution",value:"Execution Mandate"},
];
export const portfolioMaturities: PortfolioMaturity[] = [
  {reference:"SFN-004",investor:"Kehinde Ibrahim",solution:"Starfetch Fixed Note",value:"₦107,500,000",maturity:"Nov 20, 2026",daysRemaining:"18 days",status:"Maturing Soon"},
  {reference:"SFN-003",investor:"Olamide Adebayo",solution:"Starfetch Fixed Note",value:"₦645,000,000",maturity:"Dec 15, 2026",daysRemaining:"43 days",status:"Active"},
  {reference:"SFN-001",investor:"Bluecrest Capital Ltd",solution:"Starfetch Fixed Note",value:"₦1,612,500,000",maturity:"Jun 30, 2027",daysRemaining:"240 days",status:"Active"},
];
export const recentPortfolioActivities: PortfolioActivity[] = [
  {title:"New investment booked",description:"₦500,000,000 – Starfetch Fixed Note (INV-8921)",time:"Nov 2, 2026, 10:24 AM",icon:Plus},
  {title:"Portfolio valuation updated",description:"AUM now ₦4,860,000,000 (+6.7%)",time:"Nov 2, 2026, 09:41 AM",icon:TrendingUp},
  {title:"Interest credited",description:"₦12,500,000 – SFN-001",time:"Nov 1, 2026, 04:17 PM",icon:RefreshCw},
  {title:"Redemption processed",description:"₦200,000,000 – DP-005",time:"Nov 1, 2026, 02:09 PM",icon:ArrowLeftRight},
  {title:"New mandate activated",description:"Execution Mandate – EM-007",time:"Oct 31, 2026, 11:56 AM",icon:FileText},
];
