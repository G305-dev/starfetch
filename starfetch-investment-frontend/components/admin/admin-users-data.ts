import { Layers3, LockKeyhole, Shield, Users } from "lucide-react";
import type { AccountStatus } from "./AdminBadges";
import type { AccountType, AdminStat, VerificationStatus } from "./admin-dashboard-data";

export interface AdminUser {
  name: string;
  reference: string;
  accountType: AccountType;
  email: string;
  verification: VerificationStatus;
  accountStatus: AccountStatus;
  portfolio: number;
  joined: string; // ISO date, compared to the fixed synthetic snapshot.
  lastActivity: string;
  phone: string;
  location: string;
  onboardingProgress: number;
  onboardingStages: boolean[];
}
export interface QueueItem { reference: string; description: string; date: string }
export const mockSnapshotDate = "2026-11-02";
export const usersSummary: AdminStat[] = [
  { title: "Total Users", value: "1,247", change: "+8.4%", icon: Users },
  { title: "Active Accounts", value: "1,082", change: "+10.1%", icon: Layers3 },
  { title: "Pending Verification", value: "98", change: "+26.7%", icon: Shield },
  { title: "Restricted Accounts", value: "17", change: "+41.7%", icon: LockKeyhole, changeTone: "warning" },
];
// Synthetic sample records are deliberately separate from the unrelated, illustrative aggregate KPIs.
export const adminUsers: AdminUser[] = [
  { name: "Olamide Adebayo", reference: "INV-100234", accountType: "Individual", email: "olamide.adebayo@email.com", verification: "Verified", accountStatus: "Active", portfolio: 25400000, joined: "2026-11-02", lastActivity: "10:24 AM", phone: "+234 803 456 7890", location: "Lagos, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Kehinde Ibrahim", reference: "INV-100233", accountType: "Joint", email: "kehinde.ibrahim@email.com", verification: "Pending Review", accountStatus: "Active", portfolio: 14750000, joined: "2026-11-02", lastActivity: "09:41 AM", phone: "+234 800 000 0101", location: "Lagos, Nigeria", onboardingProgress: 50, onboardingStages: [true, true, false, false] },
  { name: "Bluecrest Capital Ltd", reference: "INV-100232", accountType: "Corporate", email: "info@bluecrestcap.example", verification: "Verified", accountStatus: "Restricted", portfolio: 420000000, joined: "2026-11-01", lastActivity: "06:17 PM", phone: "+234 800 000 0102", location: "Abuja, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Aishat Tinubu", reference: "INV-100231", accountType: "Individual", email: "aishat.tinubu@email.com", verification: "Incomplete", accountStatus: "Active", portfolio: 6300000, joined: "2026-11-01", lastActivity: "02:09 PM", phone: "+234 800 000 0103", location: "Lagos, Nigeria", onboardingProgress: 25, onboardingStages: [true, false, false, false] },
  { name: "Emeka Okafor", reference: "INV-100230", accountType: "Individual", email: "emeka.okafor@email.com", verification: "Verified", accountStatus: "Suspended", portfolio: 0, joined: "2026-11-01", lastActivity: "11:56 AM", phone: "+234 800 000 0104", location: "Enugu, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Greenvalley Holdings", reference: "INV-100229", accountType: "Corporate", email: "admin@greenvalley.example", verification: "Verified", accountStatus: "Active", portfolio: 1250000000, joined: "2026-10-31", lastActivity: "08:32 PM", phone: "+234 800 000 0105", location: "Lagos, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Fatima Adewale", reference: "INV-100228", accountType: "Joint", email: "fatima.adewale@email.com", verification: "Pending Review", accountStatus: "Active", portfolio: 18900000, joined: "2026-10-31", lastActivity: "03:18 PM", phone: "+234 800 000 0106", location: "Lagos, Nigeria", onboardingProgress: 50, onboardingStages: [true, true, false, false] },
  { name: "Musa Usman", reference: "INV-100227", accountType: "Individual", email: "musa.usman@email.com", verification: "Verified", accountStatus: "Active", portfolio: 9850000, joined: "2026-10-30", lastActivity: "10:05 AM", phone: "+234 800 000 0107", location: "Kano, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Ada Nwosu", reference: "INV-100226", accountType: "Individual", email: "ada.nwosu@example.com", verification: "Incomplete", accountStatus: "Active", portfolio: 1200000, joined: "2026-10-28", lastActivity: "09:00 AM", phone: "+234 800 000 0108", location: "Lagos, Nigeria", onboardingProgress: 25, onboardingStages: [true, false, false, false] },
  { name: "Ife and Tunde Bello", reference: "INV-100225", accountType: "Joint", email: "bello@example.com", verification: "Verified", accountStatus: "Active", portfolio: 8200000, joined: "2026-10-24", lastActivity: "12:10 PM", phone: "+234 800 000 0109", location: "Ibadan, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Meridian Ventures Ltd", reference: "INV-100224", accountType: "Corporate", email: "contact@meridian.example", verification: "Pending Review", accountStatus: "Restricted", portfolio: 28000000, joined: "2026-10-20", lastActivity: "03:00 PM", phone: "+234 800 000 0110", location: "Abuja, Nigeria", onboardingProgress: 50, onboardingStages: [true, true, false, false] },
  { name: "Nneka Eze", reference: "INV-100223", accountType: "Individual", email: "nneka.eze@example.com", verification: "Rejected", accountStatus: "Suspended", portfolio: 0, joined: "2026-10-16", lastActivity: "01:20 PM", phone: "+234 800 000 0111", location: "Lagos, Nigeria", onboardingProgress: 25, onboardingStages: [true, false, false, false] },
  { name: "Seyi Martins", reference: "INV-100222", accountType: "Individual", email: "seyi.martins@example.com", verification: "Verified", accountStatus: "Active", portfolio: 4700000, joined: "2026-10-12", lastActivity: "11:45 AM", phone: "+234 800 000 0112", location: "Lagos, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Eko Partners Ltd", reference: "INV-100221", accountType: "Corporate", email: "info@ekopartners.example", verification: "Verified", accountStatus: "Active", portfolio: 48000000, joined: "2026-10-10", lastActivity: "09:30 AM", phone: "+234 800 000 0113", location: "Lagos, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Chika Obi", reference: "INV-100220", accountType: "Individual", email: "chika.obi@example.com", verification: "Pending Review", accountStatus: "Active", portfolio: 3000000, joined: "2026-10-08", lastActivity: "04:10 PM", phone: "+234 800 000 0114", location: "Port Harcourt, Nigeria", onboardingProgress: 50, onboardingStages: [true, true, false, false] },
  { name: "Amina Yusuf", reference: "INV-100219", accountType: "Individual", email: "amina.yusuf@example.com", verification: "Verified", accountStatus: "Active", portfolio: 4200000, joined: "2026-10-05", lastActivity: "10:30 AM", phone: "+234 800 000 0115", location: "Abuja, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Obi Family", reference: "INV-100218", accountType: "Joint", email: "obi.family@example.com", verification: "Verified", accountStatus: "Active", portfolio: 5000000, joined: "2026-09-01", lastActivity: "10:00 AM", phone: "+234 800 000 0116", location: "Lagos, Nigeria", onboardingProgress: 100, onboardingStages: [true, true, true, true] },
  { name: "Tolu Akin", reference: "INV-100217", accountType: "Individual", email: "tolu.akin@example.com", verification: "Incomplete", accountStatus: "Active", portfolio: 0, joined: "2026-06-01", lastActivity: "09:00 AM", phone: "+234 800 000 0117", location: "Lagos, Nigeria", onboardingProgress: 25, onboardingStages: [true, false, false, false] },
];
export const accountTypeBreakdown = [
  { label: "Individual", value: 865, percent: "69.4%", color: "#087333" },
  { label: "Corporate", value: 228, percent: "18.3%", color: "#54b92f" },
  { label: "Joint", value: 154, percent: "12.3%", color: "#b9ed1d" },
];
export const usersRecentRegistrations: QueueItem[] = [
  { reference: "INV-100233", description: "Joint Account", date: "Nov 2, 2026, 09:41 AM" },
  { reference: "INV-100234", description: "Individual Account", date: "Nov 2, 2026, 08:57 AM" },
  { reference: "INV-100228", description: "Joint Account", date: "Oct 31, 2026, 03:18 PM" },
];
export const verificationQueue: QueueItem[] = [
  { reference: "INV-100233", description: "ID & Address Verification", date: "Nov 2, 2026, 09:41 AM" },
  { reference: "INV-100228", description: "Proof of Funds", date: "Oct 31, 2026, 03:18 PM" },
  { reference: "INV-100231", description: "ID Verification", date: "Nov 1, 2026, 02:09 PM" },
];
export function formatMockDate(iso: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)); }
export function formatMockMoney(value: number) { return `₦${value.toLocaleString("en-NG")}`; }
