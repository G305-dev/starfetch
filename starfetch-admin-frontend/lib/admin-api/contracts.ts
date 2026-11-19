/** PROVISIONAL frontend DTOs, from STARFETCH-ADMIN-BACKEND-API-CONTRACT-v1-PROPOSED.md.
 * Replace with David's approved OpenAPI-generated types before go-live. */
export const PERMISSIONS = {
  dashboard: 'admin.dashboard.read', investors: 'investors.read', invite: 'investors.invite',
  deactivate: 'investors.deactivate.request', kyc: 'kyc.read', kycReview: 'kyc.review',
  kycFinal: 'kyc.compliance.final', investments: 'investments.read', investmentsPrepare: 'investments.prepare',
  transactions: 'transactions.read', transactionsPrepare: 'transactions.prepare',
  portfolios: 'portfolios.read', settings: 'settings.read', audit: 'audit.read',
} as const;
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
