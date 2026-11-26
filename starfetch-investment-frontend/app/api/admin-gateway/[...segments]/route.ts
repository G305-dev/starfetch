import {NextRequest,NextResponse} from 'next/server';
import {getSession,liveConfig,upstream} from '@/lib/admin-api/server';
import type {Permission} from '@/lib/admin-api/contracts';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff'};
function fail(status:number,code:string,message:string){return NextResponse.json({error:{code,message}},{status,headers});}
import {matchProposedRoute} from '@/lib/admin/proposed-routes';

type RouteDef={method:'GET'|'POST'|'PATCH';pattern:RegExp;permission:Permission};


/** Explicit route allowlist; not an arbitrary open reverse proxy. No posting/settling/approving financial records here. */
const routes:RouteDef[]=[
 {method:'GET',pattern:/^\/dashboard\/(summary|aum-series|allocation)$/,permission:'admin.dashboard.read'},
 {method:'GET',pattern:/^\/dashboard\/recent-registrations$/,permission:'investors.read'},
 {method:'GET',pattern:/^\/investors$/,permission:'investors.read'},
 {method:'GET',pattern:/^\/investors\/[a-f0-9-]{36}$/,permission:'investors.read'},
 {method:'GET',pattern:/^\/accounts\/search$/,permission:'investors.read'},
 {method:'GET',pattern:/^\/accounts\/[a-f0-9-]{36}\/eligibility$/,permission:'investments.prepare'},
 {method:'POST',pattern:/^\/investor-invitations$/,permission:'investors.invite'},
 {method:'POST',pattern:/^\/investors\/[a-f0-9-]{36}\/deactivation-requests$/,permission:'investors.deactivate.request'},
 {method:'GET',pattern:/^\/kyc-applications$/,permission:'kyc.read'},
 {method:'GET',pattern:/^\/kyc-applications\/[a-f0-9-]{36}(?:\/(documents|history))?$/,permission:'kyc.read'},
 {method:'POST',pattern:/^\/kyc-applications\/[a-f0-9-]{36}\/review-decisions$/,permission:'kyc.review'},
 {method:'GET',pattern:/^\/investment-solutions$/,permission:'investments.read'},
 {method:'GET',pattern:/^\/investments(?:\/[a-f0-9-]{36})?$/,permission:'investments.read'},
 {method:'POST',pattern:/^\/investment-requests$/,permission:'investments.prepare'},
 {method:'PATCH',pattern:/^\/investment-requests\/[a-f0-9-]{36}$/,permission:'investments.prepare'},
 {method:'GET',pattern:/^\/transactions(?:\/[a-f0-9-]{36})?$/,permission:'transactions.read'},
 {method:'POST',pattern:/^\/transaction-requests$/,permission:'transactions.prepare'},
 {method:'GET',pattern:/^\/portfolios\/by-solution$/,permission:'portfolios.read'},
 {method:'GET',pattern:/^\/settings\/summary$/,permission:'settings.read'},
];
function matchRoute(method:string,path:string):RouteDef|undefined{return routes.find(r=>r.method===method&&r.pattern.test(path));}

async function processRequest(req:NextRequest,params:Promise<{segments:string[]}>,method:'GET'|'POST'|'PATCH') {
 const cfg=liveConfig();if(!cfg)return fail(503,'FEATURE_UNAVAILABLE','Admin API integration is disabled pending approval');
 const {segments}=await params;
 if(!segments?.length||segments.some(x=>!x||!/^[-a-zA-Z0-9_]+$/.test(x)))return fail(404,'RESOURCE_NOT_FOUND','Unknown operation');
 const path='/'+segments.join('/');const route=matchRoute(method,path);
 if(!route){
  // A route that is proposed but not yet approved gets its own code, so David and
  // Emmanuel can tell 'not built yet' apart from 'typo in the path'.
  if(matchProposedRoute(method,path))return fail(503,'CONTRACT_NOT_APPROVED','This operation is proposed but not yet approved or implemented by the backend');
  return fail(404,'RESOURCE_NOT_FOUND','Unknown or unapproved Admin operation');
 }
 const staff=await getSession();if(!staff)return fail(401,'UNAUTHENTICATED','Staff sign-in required');
 const hasBasicPermission=staff.permissions.includes(route.permission);
 const accountSearchAllowed=path==='/accounts/search'&&['investments.prepare','transactions.prepare'].some(permission=>staff.permissions.includes(permission));
 const eligibilityAction=req.nextUrl.searchParams.get('action');
 const eligibilityAllowed=path.endsWith('/eligibility')&&((eligibilityAction==='CREATE_INVESTMENT'&&staff.permissions.includes('investments.prepare'))||(eligibilityAction==='CREATE_TRANSACTION'&&staff.permissions.includes('transactions.prepare')));
 if(!hasBasicPermission&&!accountSearchAllowed&&!eligibilityAllowed)return fail(403,'FORBIDDEN','Permission denied');
 if(path.endsWith('/eligibility')&&!eligibilityAllowed)return fail(403,'FORBIDDEN','Invalid or unauthorized eligibility operation');
 if(method!=='GET') {
  if(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site')return fail(403,'ORIGIN_REJECTED','Invalid origin');
  const csrf=req.cookies.get('__Host-sf_admin_csrf')?.value;
  if(!csrf||csrf!==req.headers.get('x-csrf-token'))return fail(403,'CSRF_REJECTED','Security token required');
  if(!/^[0-9a-f-]{36}$/i.test(req.headers.get('idempotency-key')??''))return fail(422,'IDEMPOTENCY_KEY_REQUIRED','Idempotency key required');
  if(method==='PATCH'&&!/^\d+$/.test(req.headers.get('if-match')??''))return fail(409,'VERSION_REQUIRED','Current record version required');
 }
 const cookieValue=req.cookies.get(cfg.cookie)?.value;if(!cookieValue)return fail(401,'UNAUTHENTICATED','Staff session missing');
 let body:string|undefined;
 if(method!=='GET'){
  const length=Number(req.headers.get('content-length')??0);if(length>16384)return fail(413,'PAYLOAD_TOO_LARGE','Request too large');
  body=await req.text();if(body.length>16384)return fail(413,'PAYLOAD_TOO_LARGE','Request too large');
  let parsed:unknown;try{parsed=JSON.parse(body);}catch{return fail(422,'VALIDATION_ERROR','Invalid JSON body');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return fail(422,'VALIDATION_ERROR','Expected a JSON object');
  // Guard against accidental/unauthorized financial-state writes from the UI.
  if(/(investment-requests|transaction-requests)/.test(path)){
   const keys=Object.keys(parsed);
   const allowed=path.includes('investment-requests')?['accountId','solutionCode','amountMinor','currency','termMonths','notes']:['accountId','type','amountMinor','currency','externalReference','notes'];
   if(keys.some(k=>!allowed.includes(k)))return fail(422,'VALIDATION_ERROR','Unsupported financial field');
  }
 }
 const query=req.nextUrl.search;
 try{const response=await upstream(path,{method,body,query,cookie:`${cfg.cookie}=${encodeURIComponent(cookieValue)}`,requestId:crypto.randomUUID(),csrf:req.headers.get('x-csrf-token')??undefined,idempotency:req.headers.get('idempotency-key')??undefined,match:req.headers.get('if-match')??undefined});
  if(response.status>=300&&response.status<400)return fail(502,'INVALID_UPSTREAM_REDIRECT','Unexpected backend redirect');
  const text=await response.text();if(text.length>2000000)return fail(502,'RESPONSE_TOO_LARGE','Unexpected response size');
  // Only JSON responses from the trusted backend. Never relay Set-Cookie from business APIs.
  const isJson=response.headers.get('content-type')?.includes('application/json');
  if(!isJson)return fail(502,'INVALID_UPSTREAM_RESPONSE','Unexpected backend content type');
  let json:unknown;try{json=JSON.parse(text);}catch{return fail(502,'INVALID_UPSTREAM_RESPONSE','Malformed backend response');}
  if(!response.ok){
   const payload=json&&typeof json==='object'?json as Record<string,unknown>:{};
   const err=payload.error&&typeof payload.error==='object'?payload.error as Record<string,unknown>:{};
   const code=typeof err.code==='string'&&/^[A-Z0-9_]{2,64}$/.test(err.code)?err.code:'HTTP_'+response.status;
   const message= typeof err.message==='string'&&err.message.length<250&&!/password|token|secret|nin|bvn|tin/i.test(err.message)?err.message:'Backend operation failed';
   return NextResponse.json({error:{code,message,requestId:typeof err.requestId==='string'?err.requestId:undefined}},{status:response.status,headers});
  }
  return NextResponse.json(json,{status:response.status,headers});
 }catch{return fail(503,'FEATURE_UNAVAILABLE','Admin backend unavailable');}
}
export async function GET(req:NextRequest,{params}:{params:Promise<{segments:string[]}>}){return processRequest(req,params,'GET');}
export async function POST(req:NextRequest,{params}:{params:Promise<{segments:string[]}>}){return processRequest(req,params,'POST');}
export async function PATCH(req:NextRequest,{params}:{params:Promise<{segments:string[]}>}){return processRequest(req,params,'PATCH');}
