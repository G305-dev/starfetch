import { CircleX, Clock3, ShieldCheck, Users } from "lucide-react";
import type { AccountType, AdminStat } from "./admin-dashboard-data";

export type KycStatus = "Pending Review" | "Under Review" | "Verified" | "Rejected";
export type KycChecklistKey = "identity" | "government-id" | "address" | "source" | "pep";
export interface KycChecklistItem { key: KycChecklistKey; label: string; status: string; detail: string }
export interface KycDocument { title: string; status: "Uploaded" | "Pending Review" | "Verified" | "Rejected" | "Not Uploaded" }
export interface KycActivity { action: string; actor: string; date: string; note: string }
export interface KycInvestor {
  reference: string;
  accountReference: string;
  name: string;
  email: string;
  phone: string;
  accountType: AccountType;
  status: KycStatus;
  submitted: string; // ISO date, used only to filter synthetic sample rows.
  submittedAt: string;
  registeredAt: string;
  checklist: KycChecklistItem[];
  documents: KycDocument[];
  activity: KycActivity[];
}
export const kycSnapshotDate = "2026-11-02";
export const kycSummaryStats: AdminStat[] = [
  { title:"Total Accounts", value:"1,247", change:"", icon:Users },
  { title:"Verified", value:"982", change:"78.8%", icon:ShieldCheck, comparisonLabel:"", showChangeArrow:false, showSparkline:false },
  { title:"Pending Review", value:"197", change:"15.8%", icon:Clock3, changeTone:"amber", comparisonLabel:"", showChangeArrow:false, showSparkline:false },
  { title:"Rejected", value:"68", change:"5.4%", icon:CircleX, changeTone:"warning", comparisonLabel:"", showChangeArrow:false, showSparkline:false },
];
export const kycTabs = [
  { id:"all", label:"All Investors", aggregate:"1,247" },
  { id:"pending", label:"Pending Review", aggregate:"197" },
  { id:"verified", label:"Verified", aggregate:"982" },
  { id:"rejected", label:"Rejected", aggregate:"68" },
] as const;
export type KycTab = (typeof kycTabs)[number]["id"];
const exampleChecklist: KycChecklistItem[] = [
  { key:"identity", label:"Identity Information (BVN / NIN)", status:"Provided", detail:"Mock identity information was provided. No identifier is displayed or verified." },
  { key:"government-id", label:"Government ID (NIN / Voter's Card / Passport)", status:"Uploaded", detail:"Mock government ID metadata is present. No document is stored or verified." },
  { key:"address", label:"Proof of Address", status:"Uploaded", detail:"Mock proof-of-address metadata is present. No document is stored or verified." },
  { key:"source", label:"Source of Funds / Employment", status:"Provided", detail:"Mock source-of-funds information was provided for review." },
  { key:"pep", label:"PEP Declaration", status:"Declared (No)", detail:"Synthetic declaration only; no PEP or regulatory screening has been performed." },
];
const unavailableChecklist: KycChecklistItem[] = exampleChecklist.map(item => ({ ...item, status:"Not available", detail:"No additional mock information is available for this item." }));
const exampleDocuments: KycDocument[] = [
  { title:"Government ID", status:"Uploaded" }, { title:"Proof of Address", status:"Pending Review" },
  { title:"Passport Photograph", status:"Uploaded" }, { title:"Supporting Documents", status:"Not Uploaded" },
];
const exampleActivity: KycActivity[] = [
  { action:"KYC submitted", actor:"System", date:"Nov 2, 2026, 10:24 AM", note:"Synthetic submission recorded." },
  { action:"Document uploaded", actor:"System", date:"Nov 2, 2026, 10:21 AM", note:"Mock document metadata added." },
  { action:"Review started", actor:"Starfetch Admin", date:"Nov 2, 2026, 11:10 AM", note:"Example review activity only." },
  { action:"Information requested", actor:"Starfetch Admin", date:"Nov 2, 2026, 11:15 AM", note:"Example note; no notification was sent." },
  { action:"Status updated", actor:"System", date:"Nov 2, 2026, 11:16 AM", note:"Synthetic history entry." },
];
const emptyDetails = { checklist:unavailableChecklist, documents:[] as KycDocument[], activity:[] as KycActivity[] };
export const kycInvestors: KycInvestor[] = [
  { reference:"INV-000789", accountReference:"ACC-100234", name:"Olamide Adebayo", email:"olamide.adebayo@email.com", phone:"+234 810 234 5678", accountType:"Individual", status:"Pending Review", submitted:"2026-11-02", submittedAt:"Nov 2, 2026, 10:24 AM", registeredAt:"Nov 2, 2026, 10:24 AM", checklist:exampleChecklist, documents:exampleDocuments, activity:exampleActivity },
  { reference:"INV-000788", accountReference:"ACC-100233", name:"Kehinde Ibrahim", email:"kehinde.ibrahim@email.com", phone:"+234 800 000 0101", accountType:"Joint", status:"Under Review", submitted:"2026-11-02", submittedAt:"Nov 2, 2026, 09:41 AM", registeredAt:"Nov 2, 2026, 09:41 AM", ...emptyDetails },
  { reference:"INV-000787", accountReference:"ACC-100232", name:"Bluecrest Capital Ltd", email:"info@bluecrestcap.example", phone:"+234 800 000 0102", accountType:"Corporate", status:"Verified", submitted:"2026-11-01", submittedAt:"Nov 1, 2026, 04:17 PM", registeredAt:"Nov 1, 2026, 04:17 PM", ...emptyDetails },
  { reference:"INV-000786", accountReference:"ACC-100231", name:"Aishat Tinubu", email:"aishat.tinubu@email.com", phone:"+234 800 000 0103", accountType:"Individual", status:"Verified", submitted:"2026-11-01", submittedAt:"Nov 1, 2026, 02:09 PM", registeredAt:"Nov 1, 2026, 02:09 PM", ...emptyDetails },
  { reference:"INV-000785", accountReference:"ACC-100230", name:"Emeka Okafor", email:"emeka.okafor@email.com", phone:"+234 800 000 0104", accountType:"Individual", status:"Pending Review", submitted:"2026-11-01", submittedAt:"Nov 1, 2026, 11:56 AM", registeredAt:"Nov 1, 2026, 11:56 AM", ...emptyDetails },
  { reference:"INV-000784", accountReference:"ACC-100229", name:"Sola Musa", email:"sola.musa@example.com", phone:"+234 800 000 0105", accountType:"Individual", status:"Rejected", submitted:"2026-10-31", submittedAt:"Oct 31, 2026, 05:32 PM", registeredAt:"Oct 31, 2026, 05:32 PM", ...emptyDetails },
  { reference:"INV-000783", accountReference:"ACC-100228", name:"Greenfields Holdings Ltd", email:"admin@greenfields.example", phone:"+234 800 000 0106", accountType:"Corporate", status:"Verified", submitted:"2026-10-31", submittedAt:"Oct 31, 2026, 02:18 PM", registeredAt:"Oct 31, 2026, 02:18 PM", ...emptyDetails },
  { reference:"INV-000782", accountReference:"ACC-100227", name:"Adesola Ojo", email:"adesola.ojo@example.com", phone:"+234 800 000 0107", accountType:"Individual", status:"Under Review", submitted:"2026-10-30", submittedAt:"Oct 30, 2026, 03:40 PM", registeredAt:"Oct 30, 2026, 03:40 PM", ...emptyDetails },
  { reference:"INV-000781", accountReference:"ACC-100226", name:"Ada Nwosu", email:"ada.nwosu@example.com", phone:"+234 800 000 0108", accountType:"Individual", status:"Pending Review", submitted:"2026-10-20", submittedAt:"Oct 20, 2026, 09:00 AM", registeredAt:"Oct 20, 2026, 09:00 AM", ...emptyDetails },
  { reference:"INV-000780", accountReference:"ACC-100225", name:"Ife and Tunde Bello", email:"bello@example.com", phone:"+234 800 000 0109", accountType:"Joint", status:"Verified", submitted:"2026-10-02", submittedAt:"Oct 2, 2026, 12:10 PM", registeredAt:"Oct 2, 2026, 12:10 PM", ...emptyDetails },
  { reference:"INV-000779", accountReference:"ACC-100224", name:"Meridian Ventures Ltd", email:"contact@meridian.example", phone:"+234 800 000 0110", accountType:"Corporate", status:"Rejected", submitted:"2026-09-01", submittedAt:"Sep 1, 2026, 03:00 PM", registeredAt:"Sep 1, 2026, 03:00 PM", ...emptyDetails },
  { reference:"INV-000778", accountReference:"ACC-100223", name:"Nneka Eze", email:"nneka.eze@example.com", phone:"+234 800 000 0111", accountType:"Individual", status:"Under Review", submitted:"2026-06-01", submittedAt:"Jun 1, 2026, 01:20 PM", registeredAt:"Jun 1, 2026, 01:20 PM", ...emptyDetails },
];
