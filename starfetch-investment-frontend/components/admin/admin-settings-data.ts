import { Bell, CreditCard, Database, Layers3, Link2, Settings, Shield, Users, type LucideIcon } from "lucide-react";

export interface SettingsCategory { title: string; description: string; icon: LucideIcon }

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
