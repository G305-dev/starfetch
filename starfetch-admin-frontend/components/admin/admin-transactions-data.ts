import { ArrowLeftRight, Coins, Hourglass, ShieldCheck } from "lucide-react";
import type { TransactionStatus } from "./AdminBadges";
import type { AccountType, AdminStat } from "./admin-dashboard-data";

export type TransactionType = "Deposit" | "Withdrawal" | "Investment Funding" | "Redemption" | "Return / Distribution" | "Transfer";
export interface TransactionTimelineStage { label: "Initiated" | "Under Review" | "Processed" | "Completed"; complete: boolean; date?: string }
export interface TransactionHistoryItem { action: string; timestamp: string; actor: string; note?: string }
export interface RelatedTransaction { id: string; type: TransactionType; amount: number; status: TransactionStatus; date: string }
export interface TransactionDetail { purpose: string; referenceNumber: string; completedAt: string; timeline: TransactionTimelineStage[]; notes: string; approvals: TransactionHistoryItem[]; activity: TransactionHistoryItem[]; related: RelatedTransaction[] }
export interface AdminTransaction { id: string; investor: string; email: string; accountReference: string; accountType: AccountType; type: TransactionType; amount: number; status: TransactionStatus; paymentMethod: string; created: string; createdAt: string; investmentReference?: string; detail: TransactionDetail }
export const transactionSnapshotDate = "2026-11-02";
export const transactionSummaryStats: AdminStat[] = [
  { title:"Total Transactions", value:"12,486", change:"+18.70%", icon:ArrowLeftRight },
  { title:"Pending Approvals", value:"236", change:"+12.38%", icon:Hourglass, changeTone:"amber" },
  { title:"Successful Transactions", value:"11,905", change:"+19.21%", icon:ShieldCheck },
  { title:"Total Transaction Value", value:"₦482.35B", change:"+16.44%", icon:Coins },
];
export const transactionTabs = [
  { id:"all", label:"All Transactions", aggregate:"12,486" },
  { id:"deposits", label:"Deposits", aggregate:"4,902" },
  { id:"withdrawals", label:"Withdrawals", aggregate:"2,184" },
  { id:"funding", label:"Investment Funding", aggregate:"3,210" },
  { id:"redemptions", label:"Redemptions", aggregate:"1,675" },
  { id:"failed", label:"Failed / Flagged", aggregate:"515" },
] as const;
export type TransactionTab = (typeof transactionTabs)[number]["id"];
const exampleDetail: TransactionDetail = {
  purpose:"Starfetch Fixed Note — Series IV",referenceNumber:"SF-BNT-88472193",completedAt:"Nov 2, 2026, 02:17 PM",
  timeline:[{label:"Initiated",complete:true,date:"Nov 2, 2026, 10:24 AM"},{label:"Under Review",complete:true,date:"Nov 2, 2026, 11:02 AM"},{label:"Processed",complete:true,date:"Nov 2, 2026, 01:46 PM"},{label:"Completed",complete:true,date:"Nov 2, 2026, 02:17 PM"}],
  notes:"Synthetic example: investor funded Starfetch Fixed Note Series IV (₦25,000,000) via bank transfer. Mock payment and allocation are shown as completed.",
  approvals:[{action:"Transaction initiated",timestamp:"Nov 2, 2026, 10:24 AM",actor:"System"},{action:"Reviewed by Operations",timestamp:"Nov 2, 2026, 11:02 AM",actor:"A. Johnson"},{action:"Approved and completed",timestamp:"Nov 2, 2026, 02:17 PM",actor:"D. Adebayo"}],
  activity:[{action:"Transaction created",timestamp:"Nov 2, 2026, 10:24 AM",actor:"System",note:"Mock record created."},{action:"Funds received",timestamp:"Nov 2, 2026, 10:30 AM",actor:"System"},{action:"Review started",timestamp:"Nov 2, 2026, 11:02 AM",actor:"A. Johnson"},{action:"Approval requested",timestamp:"Nov 2, 2026, 11:30 AM",actor:"A. Johnson"},{action:"Transaction processed",timestamp:"Nov 2, 2026, 01:46 PM",actor:"System"},{action:"Transaction completed",timestamp:"Nov 2, 2026, 02:17 PM",actor:"D. Adebayo"}],
  related:[{id:"TXN-MOCK-1001",type:"Deposit",amount:25000000,status:"Completed",date:"Nov 1, 2026"},{id:"TXN-00984732",type:"Investment Funding",amount:25000000,status:"Completed",date:"Nov 2, 2026"},{id:"TXN-MOCK-1002",type:"Return / Distribution",amount:1250000,status:"Pending Approval",date:"Nov 2, 2026"},{id:"TXN-MOCK-1003",type:"Redemption",amount:5000000,status:"Under Review",date:"Nov 2, 2026"}],
};
// Other records intentionally omit unavailable details instead of inventing a transaction history.
const sampleTimeline: TransactionTimelineStage[] = [{label:"Initiated",complete:true},{label:"Under Review",complete:false},{label:"Processed",complete:false},{label:"Completed",complete:false}];
const emptyDetail: TransactionDetail = { purpose:"Not provided in sample",referenceNumber:"Not provided in sample",completedAt:"Not provided in sample",timeline:[],notes:"No additional mock notes available.",approvals:[],activity:[],related:[] };
const pendingDetail: TransactionDetail = { ...emptyDetail, timeline: sampleTimeline };
export const adminTransactions: AdminTransaction[] = [
  {id:"TXN-00984732",investor:"Olamide Adebayo",email:"olamide.adebayo@email.com",accountReference:"ACC-100234",accountType:"Individual",type:"Investment Funding",amount:25000000,status:"Completed",paymentMethod:"Bank Transfer",created:"2026-11-02",createdAt:"Nov 2, 2026, 10:24 AM",investmentReference:"INV-008473",detail:exampleDetail},
  {id:"TXN-00984731",investor:"Kehinde Ibrahim",email:"kehinde.ibrahim@email.com",accountReference:"ACC-100233",accountType:"Joint",type:"Deposit",amount:12000000,status:"Pending Approval",paymentMethod:"Bank Transfer",created:"2026-11-02",createdAt:"Nov 2, 2026, 09:58 AM",detail:pendingDetail},
  {id:"TXN-00984730",investor:"Bluecrest Capital Ltd",email:"info@bluecrestcap.example",accountReference:"ACC-100232",accountType:"Corporate",type:"Withdrawal",amount:50000000,status:"Under Review",paymentMethod:"Bank Transfer",created:"2026-11-01",createdAt:"Nov 1, 2026, 04:17 PM",detail:emptyDetail},
  {id:"TXN-00984729",investor:"Aishat Tinubu",email:"aishat.tinubu@email.com",accountReference:"ACC-100231",accountType:"Individual",type:"Redemption",amount:7500000,status:"Completed",paymentMethod:"Card (Visa ••4821)",created:"2026-11-01",createdAt:"Nov 1, 2026, 02:03 PM",detail:emptyDetail},
  {id:"TXN-00984728",investor:"Emeka Okafor",email:"emeka.okafor@email.com",accountReference:"ACC-100230",accountType:"Individual",type:"Investment Funding",amount:30000000,status:"Processing",paymentMethod:"Bank Transfer",created:"2026-11-01",createdAt:"Nov 1, 2026, 11:26 AM",detail:emptyDetail},
  {id:"TXN-00984727",investor:"Sola Musa",email:"sola.musa@example.com",accountReference:"ACC-100229",accountType:"Corporate",type:"Deposit",amount:100000000,status:"Completed",paymentMethod:"RTGS",created:"2026-10-31",createdAt:"Oct 31, 2026, 04:52 PM",detail:emptyDetail},
  {id:"TXN-00984726",investor:"Greenfields Holdings Ltd",email:"admin@greenfields.example",accountReference:"ACC-100228",accountType:"Corporate",type:"Investment Funding",amount:75000000,status:"Pending Approval",paymentMethod:"Bank Transfer",created:"2026-10-31",createdAt:"Oct 31, 2026, 01:21 PM",detail:pendingDetail},
  {id:"TXN-00984725",investor:"Adesola Ojo",email:"adesola.ojo@example.com",accountReference:"ACC-100227",accountType:"Individual",type:"Withdrawal",amount:5000000,status:"Failed",paymentMethod:"Card (Mastercard ••3310)",created:"2026-10-30",createdAt:"Oct 30, 2026, 05:47 PM",detail:emptyDetail},
  {id:"TXN-00984724",investor:"Rivermere Foods Ltd",email:"finance@rivermere.example",accountReference:"ACC-100226",accountType:"Corporate",type:"Redemption",amount:20000000,status:"Completed",paymentMethod:"Bank Transfer",created:"2026-10-30",createdAt:"Oct 30, 2026, 11:09 AM",detail:emptyDetail},
  {id:"TXN-00984723",investor:"Bisi Adekunle",email:"bisi.adekunle@example.com",accountReference:"ACC-100225",accountType:"Joint",type:"Deposit",amount:15000000,status:"Under Review",paymentMethod:"Bank Transfer",created:"2026-10-29",createdAt:"Oct 29, 2026, 04:36 PM",detail:emptyDetail},
  {id:"TXN-00984722",investor:"Ada Nwosu",email:"ada.nwosu@example.com",accountReference:"ACC-100224",accountType:"Individual",type:"Return / Distribution",amount:1250000,status:"Flagged",paymentMethod:"Internal Transfer",created:"2026-09-01",createdAt:"Sep 1, 2026, 09:00 AM",detail:emptyDetail},
  {id:"TXN-00984721",investor:"Ife and Tunde Bello",email:"bello@example.com",accountReference:"ACC-100223",accountType:"Joint",type:"Transfer",amount:4000000,status:"Completed",paymentMethod:"Internal Transfer",created:"2026-06-01",createdAt:"Jun 1, 2026, 12:10 PM",detail:emptyDetail},
];
