import { Bell, ChartNoAxesColumnIncreasing, CreditCard, Database, Headphones, Layers3, Link2, Settings, Shield, Users, FileText, UserRound, type LucideIcon } from "lucide-react";
import type { AdminStat } from "./admin-dashboard-data";

export interface SettingsCategory { title: string; description: string; icon: LucideIcon }
export interface ConfigurationChange { title: string; description: string; time: string; actor: string }
// These are mock work-area groupings, not approved system roles or permissions.
export interface AdminRoleExample { label: string; description: string; count: number; icon: LucideIcon }
export type MockServiceState = "Online" | "Operational" | "Active" | "Warning" | "Degraded" | "Offline" | "Error";
export interface MockSystemStatus { service: string; state: MockServiceState; uptime: string }

export const settingsSummaryStats: AdminStat[] = [
  {title:"Admin Users",value:"12",change:"+20.0%",icon:Users},
  {title:"Security Events (30 days)",value:"48",change:"-25.0%",icon:Shield,changeDirection:"down"},
  {title:"Active Integrations",value:"6",change:"+50.0%",icon:Layers3},
  {title:"System Uptime",value:"99.98%",change:"",icon:Settings,valueDescription:"Last 30 days"},
];
export const settingsCategories: SettingsCategory[] = [
  {title:"General Settings",description:"Platform details, branding, time zone, and regional preferences.",icon:Settings},
  {title:"User Roles & Permissions",description:"Manage admin users, roles, and access control.",icon:Users},
  {title:"Security & Access",description:"Password policies, 2FA, session control, and login security.",icon:Shield},
  {title:"Notifications",description:"Configure system, email, and in-app notifications.",icon:Bell},
  {title:"Investment Configuration",description:"Manage investment solutions, series, and product settings.",icon:Layers3},
  {title:"Transaction Settings",description:"Configure payment methods, limits, and transaction rules.",icon:CreditCard},
  {title:"Integrations",description:"Manage third-party services such as bank, ID verification, email, and SMS.",icon:Link2},
  {title:"Data & System",description:"Backups, data retention, audit logs, and system maintenance.",icon:Database},
];
export const recentConfigurationChanges: ConfigurationChange[] = [
  {title:"Updated transaction limit (Individual)",description:"Limit changed from ₦5,000,000 to ₦10,000,000",time:"Nov 2, 2026, 10:24 AM",actor:"David A."},
  {title:"Added new admin user",description:"A. Johnson (Operations) granted admin access",time:"Nov 2, 2026, 09:41 AM",actor:"David A."},
  {title:"Enabled two-factor authentication (2FA)",description:"2FA made mandatory for all admin users",time:"Nov 1, 2026, 04:17 PM",actor:"System"},
  {title:"Updated Starfetch Fixed Note (Series IV) settings",description:"Yield: 15.00% p.a., Term: 36 months",time:"Oct 31, 2026, 02:09 PM",actor:"A. Johnson"},
];
export const adminRoles: AdminRoleExample[] = [
  {label:"Administrators",description:"Illustrative administration group",count:4,icon:UserRound},
  {label:"Operations",description:"Illustrative operations work area",count:3,icon:Shield},
  {label:"Compliance",description:"Illustrative verification work area",count:2,icon:FileText},
  {label:"Analytics",description:"Illustrative reporting work area",count:2,icon:ChartNoAxesColumnIncreasing},
  {label:"Support",description:"Illustrative support work area",count:1,icon:Headphones},
];
export const systemStatus: MockSystemStatus[] = [
  {service:"Application Service",state:"Online",uptime:"99.98%"},
  {service:"Database",state:"Online",uptime:"99.98%"},
  {service:"File Storage",state:"Online",uptime:"99.97%"},
  {service:"Email Service",state:"Online",uptime:"99.99%"},
  {service:"SMS Service",state:"Online",uptime:"99.96%"},
  {service:"ID Verification (KYC)",state:"Online",uptime:"99.98%"},
];
