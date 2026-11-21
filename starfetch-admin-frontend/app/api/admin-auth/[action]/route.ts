import {NextRequest,NextResponse} from 'next/server';
import {getSession,liveConfig,upstream} from '@/lib/admin-api/server';
import {randomUUID} from 'crypto';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff'};
function deny(status:number,code:string,message:string){return NextResponse.json({error:{code,message}},{status,headers:noStore});}
function sameOrigin(req:NextRequest):boolean {
 const origin=req.headers.get('origin');return !!origin&&origin===req.nextUrl.origin&&req.headers.get('sec-fetch-site')!=='cross-site';
}
function sessionCookie(req:NextRequest,name:string):string|undefined {return req.cookies.get(name)?.value;}
function setStaffCookie(res:NextResponse,name:string,value:string){res.cookies.set(name,value,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*8});}
function clearStaffCookie(res:NextResponse,name:string){res.cookies.set(name,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});res.cookies.set('__Host-sf_admin_csrf','',{secure:true,sameSite:'strict',path:'/',maxAge:0});}
export async function GET(req:NextRequest,context:{params:Promise<{action:string}>}) {
 const {action}=await context.params;if(action!=='session')return deny(405,'METHOD_NOT_ALLOWED','Unsupported auth operation');
 if(!liveConfig())return deny(503,'FEATURE_UNAVAILABLE','Staff authentication is not connected');
 const staff=await getSession();return staff?NextResponse.json({data:staff},{headers:noStore}):deny(401,'UNAUTHENTICATED','No valid staff session');
}
export async function POST(req:NextRequest,context:{params:Promise<{action:string}>}) {
 const {action}=await context.params;const cfg=liveConfig();if(!cfg)return deny(503,'FEATURE_UNAVAILABLE','Staff authentication is not connected');
 if(!sameOrigin(req))return deny(403,'ORIGIN_REJECTED','Invalid request origin');
 if(action!=='login'&&action!=='logout')return deny(405,'METHOD_NOT_ALLOWED','Unsupported auth operation');
 if(action==='logout') {
  const token=req.cookies.get('__Host-sf_admin_csrf')?.value;
  if(!token||token!==req.headers.get('x-csrf-token'))return deny(403,'CSRF_REJECTED','Security token required');
  const session=sessionCookie(req,cfg.cookie);
  let revoked=false;
  try {if(session){const response=await upstream('/auth/logout',{method:'POST',cookie:`${cfg.cookie}=${encodeURIComponent(session)}`,csrf:token});revoked=response.ok;}else revoked=true;}catch{revoked=false;}
  const result=revoked?NextResponse.json({data:{loggedOut:true}},{headers:noStore}):deny(503,'LOGOUT_REVOCATION_UNCONFIRMED','Staff session was cleared locally, but remote revocation must be verified');
  clearStaffCookie(result,cfg.cookie);return result;
 }
 const len=Number(req.headers.get('content-length')??0);if(len>4096)return deny(413,'PAYLOAD_TOO_LARGE','Request too large');
 const body:unknown=await req.json().catch(()=>null);
 if(!body||typeof body!=='object')return deny(422,'VALIDATION_ERROR','Enter staff email and password');
 const {email,password}=body as {email?:unknown;password?:unknown};
 if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||typeof password!=='string'||password.length<1||password.length>256)return deny(422,'VALIDATION_ERROR','Enter valid staff credentials');
 try {
  const upstreamRes=await upstream('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
  if(!upstreamRes.ok)return deny(upstreamRes.status===429?429:401,upstreamRes.status===429?'RATE_LIMITED':'UNAUTHENTICATED',upstreamRes.status===429?'Too many login attempts':'Invalid staff credentials');
  const setCookies=upstreamRes.headers.getSetCookie();
  const staffSet=setCookies.find(value=>value.startsWith(cfg.cookie+'='));
  if(!staffSet)return deny(503,'AUTH_COOKIE_CONTRACT_MISSING','Staff session cookie contract is not available');
  const encoded=staffSet.slice((cfg.cookie+'=').length).split(';',1)[0];
  if(!encoded||encoded.length>4096)return deny(503,'INVALID_STAFF_SESSION','Invalid staff cookie');
  const sessionRes=await upstream('/auth/session',{cookie:`${cfg.cookie}=${encoded}`});
  const payload:unknown=await sessionRes.json().catch(()=>null);
  const staff=payload&&typeof payload==='object'&&'data' in payload?(payload as {data:Record<string,unknown>}).data:null;
  if(!sessionRes.ok||!staff||!['ADMIN','STAFF'].includes(String(staff.role))||typeof staff.staffId!=='string'||!Array.isArray(staff.permissions)||typeof staff.sessionExpiresAt!=='string'||new Date(staff.sessionExpiresAt).getTime()<=Date.now())return deny(403,'NOT_STAFF','Staff authorization not confirmed');
  const result=NextResponse.json({data:{staffId:staff.staffId,displayName:staff.displayName,role:staff.role,permissions:staff.permissions,sessionExpiresAt:staff.sessionExpiresAt}},{headers:noStore});
  setStaffCookie(result,cfg.cookie,decodeURIComponent(encoded));
  result.cookies.set('__Host-sf_admin_csrf',randomUUID(),{httpOnly:false,secure:true,sameSite:'strict',path:'/',maxAge:60*60*8});
  return result;
 }catch{return deny(503,'FEATURE_UNAVAILABLE','Staff authentication service unavailable');}
}
