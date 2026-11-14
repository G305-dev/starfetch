import { ArrowLeftRight, BadgeCheck, ChartNoAxesColumnIncreasing, CircleGauge, FileText, Home, Layers3, Mail, Scale, Settings, ShieldCheck, UserPlus, Users, Megaphone, type LucideIcon } from "lucide-react";

export type AccountType = "Individual" | "Joint" | "Corporate";
export type VerificationStatus = "Pending" | "Pending Review" | "Under Review" | "Incomplete" | "Verified" | "Rejected";
export interface AdminStat { title: string; value: string; change: string; icon: LucideIcon; changeTone?: "warning" | "amber"; showChangeArrow?: boolean; showSparkline?: boolean; comparisonLabel?: string; valueDescription?: string; changeDirection?: "up" | "down" }
export interface Registration { name: string; email: string; accountType: AccountType; date: string; status: VerificationStatus; reference: string }
export interface ActionItem { title: string; description: string; count: number; icon: LucideIcon }
export interface ActivityItem { title: string; description: string; time: string; icon: LucideIcon }

export const adminNavigation: { label: string; href: string; icon: LucideIcon; count?: number }[] = [
  { label: "Overview", href: "/admin/dashboard", icon: Home },
  { label: "Users & Accounts", href: "/admin/users", icon: Users },
  { label: "KYC & Verification", href: "/admin/kyc", icon: ShieldCheck, count: 24 },
  { label: "Investments", href: "/admin/investments", icon: Layers3 },
  { label: "Transactions", href: "/admin/transactions", icon: ArrowLeftRight },
  { label: "Portfolios", href: "/admin/portfolios", icon: CircleGauge },
  { label: "Reports & Analytics", href: "/admin/reports", icon: ChartNoAxesColumnIncreasing },
  { label: "Compliance", href: "/admin/compliance", icon: Scale },
  { label: "Communications", href: "/admin/communications", icon: Mail },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
export const adminStats: AdminStat[] = [
  { title: "Total Investors", value: "1,247", change: "+8.4%", icon: Users },
  { title: "Verified Investors", value: "982", change: "+10.1%", icon: ShieldCheck },
  { title: "Total AUM", value: "₦4,860,000,000", change: "+6.7%", icon: Layers3 },
  { title: "Total Transactions", value: "3,982", change: "+12.4%", icon: ArrowLeftRight },
];
export const aumChartData = [3.25,3.32,3.35,3.46,3.5,3.62,3.65,3.8,3.9,3.78,3.76,3.81,3.95,4.1,4.16,4.19,4.25,4.23,4.43,4.49,4.32,4.4,4.58,4.6,4.56,4.64,4.63,4.75,4.78,4.69,4.79,4.86];
export const aumAllocation = [
  { name: "Starfetch Fixed Note", value: 52, color: "#08782b" },
  { name: "Discretionary Portfolio", value: 32, color: "#55b72d" },
  { name: "Execution Mandate", value: 16, color: "#b9ed1d" },
];
export const pendingActions: ActionItem[] = [
  { title: "KYC Verification", description: "Investor profiles awaiting review", count: 24, icon: ShieldCheck },
  { title: "New Account Applications", description: "Accounts to approve", count: 12, icon: FileText },
  { title: "Investment Requests", description: "Funding / mandate requests", count: 5, icon: ArrowLeftRight },
  { title: "Profile Updates", description: "Investor updates to review", count: 7, icon: Users },
];
export const recentRegistrations: Registration[] = [
  { name: "Olamide Adebayo", email: "olamide.adebayo@email.com", accountType: "Individual", date: "Nov 2, 2026, 10:24 AM", status: "Pending", reference: "SF-MOCK-001" },
  { name: "Kehinde Ibrahim", email: "kehinde.ibrahim@email.com", accountType: "Joint", date: "Nov 2, 2026, 09:41 AM", status: "Under Review", reference: "SF-MOCK-002" },
  { name: "Bluecrest Capital Ltd", email: "info@bluecrestcap.example", accountType: "Corporate", date: "Nov 1, 2026, 04:17 PM", status: "Verified", reference: "SF-MOCK-003" },
  { name: "Aishat Tinubu", email: "aishat.tinubu@email.com", accountType: "Individual", date: "Nov 1, 2026, 02:09 PM", status: "Verified", reference: "SF-MOCK-004" },
  { name: "Emeka Okafor", email: "emeka.okafor@email.com", accountType: "Individual", date: "Nov 1, 2026, 11:56 AM", status: "Pending", reference: "SF-MOCK-005" },
];
export const quickActions = [
  { title: "Add Investor", icon: UserPlus }, { title: "Record Investment", icon: Layers3 },
  { title: "Record Transaction", icon: ArrowLeftRight }, { title: "Send Notification", icon: Megaphone },
];
export const systemHealth = ["API Service", "Database", "Email Service"];
export const recentSystemActivity: ActivityItem[] = [
  { title: "New investor registered", description: "Olamide Adebayo (Individual)", time: "10:24 AM", icon: UserPlus },
  { title: "KYC submitted", description: "Kehinde Ibrahim (Joint)", time: "09:41 AM", icon: ShieldCheck },
  { title: "Investment recorded", description: "₦50,000,000 – Starfetch Fixed Note", time: "Yesterday, 04:17 PM", icon: ArrowLeftRight },
  { title: "Account verified", description: "Aishat Tinubu (Individual)", time: "Yesterday, 02:09 PM", icon: BadgeCheck },
];
