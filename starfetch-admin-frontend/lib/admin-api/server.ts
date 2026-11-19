import {cookies} from 'next/headers';
import {randomUUID} from 'crypto';
import type {StaffSession,Permission} from './contracts';
/** The integration is deliberately off by default. Flip only after David's APIs, cookie
 * contract, security testing, operational sign-off and data-location approval. */
export function liveConfig():{base:string;cookie:string}|null {
 if(process.env.ADMIN_STAFF_INTEGRATION_ENABLED!=='approved-v1'||process.env.ADMIN_RELEASE_APPROVED!=='true')return null;
 const raw=process.env.ADMIN_BACKEND_URL;const cookie=process.env.ADMIN_STAFF_SESSION_COOKIE;
 if(!raw||!cookie||!/^__Host-[a-zA-Z0-9_-]{1,64}$/.test(cookie))return null;
 try{const url=new URL(raw);if(url.username||url.password||url.search||url.hash)return null;
 if(url.protocol!=='https:'&&!(process.env.NODE_ENV==='development'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return null;
 return {base:url.origin+url.pathname.replace(/\/$/,''),cookie};}catch{return null;}
}
function adminCookie(name:string,value:string):string {return `${name}=${encodeURIComponent(value)}`;}
export async function upstream(path:string,options:{method?:'GET'|'POST'|'PATCH';body?:string;cookie?:string;requestId?:string;csrf?:string;idempotency?:string;match?:string;query?:string}={}):Promise<Response> {
 const config=liveConfig();if(!config)throw new Error('ADMIN_INTEGRATION_DISABLED');
 const headers:Record<string,string>={'Accept':'application/json','X-Request-ID':options.requestId??randomUUID()};
 if(options.cookie)headers.Cookie=options.cookie;
 if(options.body!==undefined)headers['Content-Type']='application/json';
 if(options.csrf)headers['X-CSRF-Token']=options.csrf;
 if(options.idempotency)headers['Idempotency-Key']=options.idempotency;
 if(options.match)headers['If-Match']=options.match;
 return fetch(`${config.base}/api/v1/admin${path}${options.query??''}`,{method:options.method??'GET',headers,body:options.body,cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'manual'});
}
export async function getSession():Promise<StaffSession|null> {
 const cfg=liveConfig();if(!cfg)return null;
 const cookieValue=(await cookies()).get(cfg.cookie)?.value;if(!cookieValue)return null;
 try{const result=await upstream('/auth/session',{cookie:adminCookie(cfg.cookie,cookieValue)});
 if(!result.ok)return null;const payload:unknown=await result.json();if(!payload||typeof payload!=='object'||!('data' in payload))return null;
 const d=(payload as {data:Record<string,unknown>}).data;
 if(!d||typeof d.staffId!=='string'||typeof d.displayName!=='string'||(d.role!=='STAFF'&&d.role!=='ADMIN')||!Array.isArray(d.permissions)||!d.permissions.every(v=>typeof v==='string')||typeof d.sessionExpiresAt!=='string'||new Date(d.sessionExpiresAt).getTime()<=Date.now())return null;
 return d as unknown as StaffSession;
 }catch{return null;}
}
export function can(session:StaffSession|null,permission:Permission):boolean {return !!session&&session.permissions.includes(permission);}
