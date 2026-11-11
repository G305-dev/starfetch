import {
  ArrowUpRight,
  BriefcaseBusiness,
  LayoutDashboard,
  LineChart,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/** Static individual-portal navigation only — investor data is loaded from approved APIs. */
export type PortalNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
};

export const portalNavigation: PortalNavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Investments", href: "/investments", icon: LineChart },
  { label: "Transactions", href: "/transactions", icon: ArrowUpRight },
  { label: "Products", href: "/products", icon: BriefcaseBusiness },
  { label: "Profile", href: "/profile", icon: UserRound },
];
