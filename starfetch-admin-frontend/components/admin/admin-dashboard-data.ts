import { CircleGauge, Home, Layers3, Settings, ShieldCheck, Users, ArrowLeftRight, type LucideIcon } from "lucide-react";

/** Static navigation only; no account, health or financial fixtures. */
export const adminNavigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/admin/dashboard", icon: Home },
  { label: "Users & Accounts", href: "/admin/users", icon: Users },
  { label: "KYC & Verification", href: "/admin/kyc", icon: ShieldCheck },
  { label: "Investments", href: "/admin/investments", icon: Layers3 },
  { label: "Transactions", href: "/admin/transactions", icon: ArrowLeftRight },
  { label: "Portfolios", href: "/admin/portfolios", icon: CircleGauge },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
