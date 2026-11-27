/** PROVISIONAL frontend DTOs, from STARFETCH-ADMIN-BACKEND-API-CONTRACT-v1-PROPOSED.md.
 * Replace with David's approved OpenAPI-generated types before go-live. */
/**
 * PERMISSION CATALOGUE — PROPOSED, pending Starfetch's approval of the
 * operational permission matrix.
 *
 * Every key that existed before the consolidation is preserved verbatim (see
 * `LEGACY_PERMISSION_KEYS` below); the additions are new keys for the sections
 * this expansion introduces. Nothing was renamed, because the backend may already
 * issue the existing strings.
 *
 * Granularity is deliberate. A single broad `ADMIN` role cannot express "may read
 * KYC but may not issue a final compliance decision", and the maker-checker
 * requirement means the ability to PREPARE and the ability to APPROVE must be
 * separable keys, not one flag.
 *
 * These are display and navigation controls ONLY. Hiding a button is not
 * authorization: David's backend must independently authorize every request.
 */
export const PERMISSIONS = {
  // ---- Existing keys (unchanged) ----
  dashboard: 'admin.dashboard.read', investors: 'investors.read', invite: 'investors.invite',
  deactivate: 'investors.deactivate.request', kyc: 'kyc.read', kycReview: 'kyc.review',
  kycFinal: 'kyc.compliance.final', investments: 'investments.read', investmentsPrepare: 'investments.prepare',
  transactions: 'transactions.read', transactionsPrepare: 'transactions.prepare',
  portfolios: 'portfolios.read', settings: 'settings.read', audit: 'audit.read',

  // ---- Investor & account management ----
  accountsRead: 'accounts.read',
  accountsUpdate: 'accounts.update.request',
  accountsSuspend: 'accounts.suspend.request',
  accountsClose: 'accounts.close.request',
  bankDetailsRead: 'bank-details.read',
  bankDetailsChangeRequest: 'bank-details.change.request',

  // ---- KYC & compliance ----
  kycDocumentsView: 'kyc.documents.view',
  kycAmendReview: 'kyc.amend-review.request',
  complianceAmlReview: 'compliance.aml-review',
  compliancePepReview: 'compliance.pep-review',
  complianceRiskAssess: 'compliance.risk-assess',

  // ---- Investment management ----
  investmentsApprove: 'investments.approve',
  investmentsFund: 'investments.funding.verify',
  investmentsBook: 'investments.book',
  investmentsRedeem: 'investments.redemption.request',
  investmentsRollover: 'investments.rollover.request',

  // ---- Transactions ----
  transactionsApprove: 'transactions.approve',
  transactionsSettle: 'transactions.settle.verify',
  transactionsReverse: 'transactions.reverse.request',

  // ---- Portfolios ----
  portfoliosValuationAdjust: 'portfolios.valuation-adjust.request',

  // ---- Products ----
  productsRead: 'products.read',
  productsDraft: 'products.draft',
  productsApprove: 'products.approve',
  productsPublish: 'products.publish',
  productsRateChange: 'products.rate-change.request',

  // ---- Campaigns ----
  campaignsRead: 'campaigns.read',
  campaignsDraft: 'campaigns.draft',
  campaignsApprove: 'campaigns.approve',
  campaignsPublish: 'campaigns.publish',

  // ---- Notifications ----
  notificationsRead: 'notifications.read',
  notificationsCompose: 'notifications.compose',
  notificationsApprove: 'notifications.approve',
  notificationsSchedule: 'notifications.schedule',
  notificationsTemplates: 'notifications.templates.manage',
  notificationsRetry: 'notifications.retry.request',
  notificationsSettings: 'notifications.settings.manage',

  // ---- Approval Center ----
  approvalsRead: 'approvals.read',
  approvalsApprove: 'approvals.approve',
  approvalsReject: 'approvals.reject',

  // ---- Maturities & redemptions ----
  maturitiesRead: 'maturities.read',
  maturitiesSettle: 'maturities.settlement.verify',

  // ---- Finance & reconciliation ----
  financeRead: 'finance.read',
  financeReconcile: 'finance.reconcile',
  financeStatementImport: 'finance.statement-import',
  financeAdjustmentRequest: 'finance.adjustment.request',
  financeApprove: 'finance.approve',

  // ---- Reports ----
  reportsRead: 'reports.read',
  reportsExport: 'reports.export.request',

  // ---- Documents ----
  documentsRead: 'documents.read',
  documentsView: 'documents.view',
  documentsDownload: 'documents.download.request',
  documentsAccessHistory: 'documents.access-history.read',

  // ---- Support & complaints ----
  supportRead: 'support.read',
  supportRespond: 'support.respond',
  supportAssign: 'support.assign',
  supportEscalate: 'support.escalate',
  supportInternalNotes: 'support.internal-notes.read',

  // ---- Staff & permissions ----
  staffRead: 'staff.read',
  staffInvite: 'staff.invite',
  staffRoleAssign: 'staff.role.assign.request',
  staffSuspend: 'staff.suspend.request',
  staffSessionsRead: 'staff.sessions.read',
  staffSessionsRevoke: 'staff.sessions.revoke.request',
  staffPermissionsApprove: 'staff.permissions.approve',

  // ---- Audit ----
  auditExport: 'audit.export.request',
  securityMonitorRead: 'security.monitor.read',

  // ---- Settings ----
  settingsGeneral: 'settings.general.manage',
  settingsSecurity: 'settings.security.manage',
  settingsIntegrationRead: 'settings.integration.read',
} as const;

/**
 * The permission keys that existed before this consolidation. Preserved so a
 * test can prove none were renamed or removed — a rename would silently strip
 * access from staff the backend already scopes correctly.
 */
export const LEGACY_PERMISSION_KEYS = [
  'dashboard', 'investors', 'invite', 'deactivate', 'kyc', 'kycReview', 'kycFinal',
  'investments', 'investmentsPrepare', 'transactions', 'transactionsPrepare',
  'portfolios', 'settings', 'audit',
] as const;

export type LegacyPermissionKey = (typeof LEGACY_PERMISSION_KEYS)[number];
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export interface StaffSession { staffId: string; displayName: string; role: 'STAFF' | 'ADMIN'; permissions: string[]; sessionExpiresAt: string }
export type AccountType = 'INDIVIDUAL' | 'JOINT' | 'CORPORATE';
export interface PageMeta { page:number; pageSize:number; total:number; totalPages:number }
export interface ApiEnvelope<T> { data:T; meta?:PageMeta; requestId?:string }
export interface Investor { investorId:string; accountId?:string|null; accountReference?:string|null; displayName:string; emailMasked?:string|null; accountType: AccountType; accountStatus:string; kycStatus?:string|null; createdAt:string; updatedAt?:string; [field:string]:unknown }
export interface Account { accountId:string; accountReference:string; displayName?:string; accountType:AccountType; status?:string; kycStatus?:string; [field:string]:unknown }
export interface Eligibility { accountId:string; accountReference:string; status:string; kycStatus:string; complianceApproved:boolean; investmentEligible?:boolean; transactionEligible?:boolean; restrictions:string[] }
export interface KycApplication { applicationId:string; accountReference?:string; investorDisplayName?:string; accountType?:AccountType; status:string; tier?:string; sectionKeys?:string[]; sections?:{key:string;label:string;status:string}[]; version?:number; reviewerStaffId?:string|null; [field:string]:unknown }
export interface Investment { investmentId:string; investmentReference:string; accountId:string; accountReference:string; investorDisplayName:string; accountType:AccountType; solutionCode:string; solutionName:string; amountInvestedMinor:string; currentValueMinor:string|null; currency:string; status:string; startDate?:string|null; maturityDate?:string|null; expectedYieldBps?:number|null; totalReturnMinor?:string|null; valuationAsOf?:string|null; version?:number }
export interface InvestmentSolution { solutionCode:string; solutionName:string; productId?:string; available?:boolean; [field:string]:unknown }
export interface Transaction { transactionId:string; transactionReference?:string; accountId:string; accountReference:string; investorDisplayName?:string; type:string; status:string; amountMinor:string; currency:string; occurredAt:string; description?:string|null; [field:string]:unknown }
export interface PortfolioRow { solutionCode:string; investmentSolution:string; amountInvestedMinor:string; currentValueMinor:string|null }
export interface PortfolioSummary { currency:string; asOf:string|null; valuationStatus:string; rows:PortfolioRow[] }
export interface DashboardSummary { totalInvestors:number|null; verifiedInvestors:number|null; totalAumMinor:string|null; currency:string; pendingKycCount:number|null; asOf:string|null; valuationStatus?:string }
export interface AumPoint { asOf:string; valueMinor:string|null }
export interface AllocationRow { solutionCode?:string; investmentSolution:string; amountMinor:string|null; percentage?:number|null }
export interface SettingsStat { title:string; value:string|number|null; description?:string }
/** Summary's exact four fields require David's approved schema; do not synthesize metrics. */
export interface SettingsSummary { cards: SettingsStat[] }
export const isGranted=(session:StaffSession,permission:string)=>session.permissions.includes(permission);
/** Always use BigInt decimal minor-unit strings; never Number() a financial amount. */
export function money(minor:string|null|undefined,currency='NGN'):string {
 if (minor == null || !/^-?\d+$/.test(minor)) return 'Not available';
 try { const value=BigInt(minor); const sign=value<0n?'-':''; const abs=value<0n?-value:value; const units=abs/100n; const cents=(abs%100n).toString().padStart(2,'0'); const chunks=units.toString().replace(/\B(?=(\d{3})+(?!\d))/g,','); return `${sign}${currency==='NGN'?'₦':currency+' '}${chunks}.${cents}`; } catch{return 'Not available';}
}
export function na(value:string|number|null|undefined):string {return value==null||value===''?'Not available':String(value)}
export function date(value:string|null|undefined):string {if(!value)return 'Not available';const d=new Date(value);return Number.isNaN(d.getTime())?'Not available':d.toLocaleDateString('en-NG',{day:'2-digit',month:'short',year:'numeric'});}
/** Reject invalid monetary strings instead of rounding floats. */
export function toMinor(naira:string):string|null {
 const s=naira.trim();if(!/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.test(s))return null;
 const [whole,fraction='']=s.split('.');const v=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));return v>0n&&v<=1000000000000000000n?v.toString():null;
}
