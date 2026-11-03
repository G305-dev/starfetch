import {
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  FileDown,
  FolderUp,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

/** Static interface and product-discovery content only — no investor account data. */
export type IndividualQuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
};

export const individualQuickActions: IndividualQuickAction[] = [
  { label: "Create an Investment", href: "/products", icon: BriefcaseBusiness, primary: true },
  { label: "See Investments", href: "/investments", icon: BriefcaseBusiness },
  { label: "Download Statements", href: "/dashboard#statements", icon: FileDown },
  { label: "Upload Documents", href: "/dashboard#documents", icon: FolderUp },
];

export const individualInvestmentSolutions = [
  {
    title: "Starfetch Fixed Note",
    description: "A fixed-income solution designed for capital preservation and steady income.",
    icon: CircleDollarSign,
    tone: "gold",
  },
  {
    title: "Discretionary Portfolio",
    description: "Professionally managed investments under an agreed mandate and risk profile.",
    icon: BarChart3,
    tone: "green",
  },
  {
    title: "Execution Mandate",
    description: "You make the investment decisions while Starfetch supports execution and administration.",
    icon: LayoutDashboard,
    tone: "sage" as const,
  },
] as const;
