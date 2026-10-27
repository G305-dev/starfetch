import {
  Bell,
  Building2,
  KeyRound,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type CorporateSettingsTabId = "account" | "security" | "notifications" | "user-access" | "preferences";

export type CorporateSettingsTab = {
  id: CorporateSettingsTabId;
  label: string;
  icon: LucideIcon;
};

export const corporateSettingsTabs: CorporateSettingsTab[] = [
  { id: "account", label: "Account Settings", icon: Settings2 },
  { id: "security", label: "Security", icon: LockKeyhole },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "user-access", label: "User Access", icon: UsersRound },
  { id: "preferences", label: "Preferences", icon: Settings2 },
];

export type CompanySettings = {
  name: string;
  registrationNumber: string;
  email: string;
  phone: string;
  website: string;
};

export const companySettings: CompanySettings = {
  name: "Meridian Holdings Limited",
  registrationNumber: "RC 1234567",
  email: "info@meridianholdings.com",
  phone: "+234 801 234 5678",
  website: "www.meridianholdings.com",
};

export type SettingsContactPerson = {
  fullName: string;
  designation: string;
  email: string;
  phone: string;
};

export const contactPersonSettings: SettingsContactPerson = {
  fullName: "Adaeze Okafor",
  designation: "Chief Financial Officer",
  email: "adaeze.okafor@meridianholdings.com",
  phone: "+234 802 345 6789",
};

export const securitySettings = {
  passwordLastUpdated: "12 Mar 2024",
  twoFactorEnabled: true,
  recentLoginActivity: [
    { id: "login-1", location: "Lagos, Nigeria", device: "Chrome on Windows", time: "Today, 09:42", current: true },
    { id: "login-2", location: "Lagos, Nigeria", device: "Safari on iPhone", time: "Yesterday, 18:14", current: false },
  ],
  activeSessions: 2,
};

export type NotificationPreference = {
  id: "investmentUpdates" | "transactionNotifications" | "statementsReports" | "productUpdates" | "complianceNotifications" | "emailNotifications" | "inAppNotifications";
  label: string;
  description: string;
  enabled: boolean;
};

export const notificationPreferences: NotificationPreference[] = [
  { id: "investmentUpdates", label: "Investment updates", description: "Updates on your portfolio and returns", enabled: true },
  { id: "transactionNotifications", label: "Transaction notifications", description: "Alerts for all transactions", enabled: true },
  { id: "statementsReports", label: "Statements and reports", description: "Monthly statements and reports", enabled: true },
  { id: "productUpdates", label: "Product updates", description: "New investment opportunities", enabled: true },
  { id: "complianceNotifications", label: "Compliance notifications", description: "Important regulatory and compliance updates", enabled: true },
  { id: "emailNotifications", label: "Email notifications", description: "Receive alerts in your registered email inbox", enabled: true },
  { id: "inAppNotifications", label: "In-app notifications", description: "Receive alerts inside the investor portal", enabled: true },
];

export type CorporateUser = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Signatory" | "Viewer" | "Finance User";
  status: "Active" | "Pending";
  lastActive: string;
};

export const userAccess: CorporateUser[] = [
  { id: "user-1", name: "Adaeze Okafor", email: "adaeze.okafor@meridianholdings.com", role: "Admin", status: "Active", lastActive: "Today, 09:42" },
  { id: "user-2", name: "Chinedu Adeyemi", email: "chinedu.adeyemi@meridianholdings.com", role: "Signatory", status: "Active", lastActive: "Yesterday, 18:14" },
  { id: "user-3", name: "Ifeanyi Nwosu", email: "ifeanyi.nwosu@meridianholdings.com", role: "Finance User", status: "Active", lastActive: "18 Jun 2024" },
];

export type PreferenceSettings = {
  communicationMethod: "Email" | "Phone" | "In-app";
  dashboardPeriod: "This month" | "This quarter" | "This year";
  currencyDisplay: "NGN (₦)" | "USD ($)";
  reportFrequency: "Monthly" | "Quarterly";
  dateFormat: "DD MMM YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  language: "English";
};

export const preferences: PreferenceSettings = {
  communicationMethod: "Email",
  dashboardPeriod: "This month",
  currencyDisplay: "NGN (₦)",
  reportFrequency: "Monthly",
  dateFormat: "DD MMM YYYY",
  language: "English",
};

export const settingsVerification = {
  heading: "Account verification complete",
  detail: "Your account is verified and all settings are configured correctly.",
  icon: ShieldCheck,
};

export const settingsCardIcons = {
  company: Building2,
  contact: UsersRound,
  password: KeyRound,
  security: LockKeyhole,
};
