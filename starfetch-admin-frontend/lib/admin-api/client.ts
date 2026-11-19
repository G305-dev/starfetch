"use client";
import type {ApiEnvelope,PageMeta} from './contracts';
export class AdminApiError extends Error { constructor(public status:number,public code:string,message:string){super(message);this.name='AdminApiError';} }
function safePath(path:string):string {
 if(!/^\/[a-z0-9][a-z0-9/_.-]*$/i.test(path)||path.includes('..')||path.includes('//'))throw new AdminApiError(400,'INVALID_PATH','Invalid API path');
 return path;
}
function parseError(status:number, payload:unknown):AdminApiError {
 const obj=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};
 const inner=obj.error&&typeof obj.error==='object'?obj.error as Record<string,unknown>:{};
 const code=typeof inner.code==='string'?inner.code:'HTTP_'+status;
 let message='Request failed. Please try again.';
 if(status===401)message='Your staff session expired. Please sign in again.';
 else if(status===403)message='You do not have permission to perform this action.';
 else if(code==='ACCOUNT_NOT_FOUND'||code==='USER_NOT_FOUND')message='User not found. Confirm that the investor has a registered Starfetch account.';
 else if(code==='ACCOUNT_NOT_ELIGIBLE'||code==='ACCOUNT_RESTRICTED')message='This account is not eligible for the requested action.';
 else if(status===409)message='The record changed. Reload before trying again.';
 else if(status===429)message='Too many requests. Please try again later.';
 else if(status===503)message='This service is not available. No changes were made.';
 else if(status===422&&typeof inner.message==='string')message=inner.message;
 return new AdminApiError(status,code,message);
}
export async function apiRequest<T>(path:string,{method='GET',query,body,signal,version,idempotencyKey}:{method?:'GET'|'POST'|'PATCH';query?:Record<string,string|number|undefined>;body?:unknown;signal?:AbortSignal;version?:number;idempotencyKey?:string}={}):Promise<ApiEnvelope<T>> {
 const q=new URLSearchParams();for(const [k,v] of Object.entries(query??{})){if(v!==undefined&&v!=='')q.set(k,String(v));}
 const url='/api/admin-gateway'+safePath(path)+(q.size?'?'+q.toString():'');
 const csrf=typeof document==='undefined'?'':decodeURIComponent(document.cookie.match(/(?:^|;\s*)__Host-sf_admin_csrf=([^;]*)/)?.[1]??'');
 const headers:Record<string,string>={'Accept':'application/json'};
 if(method!=='GET'){headers['Content-Type']='application/json';headers['X-CSRF-Token']=csrf;headers['Idempotency-Key']=idempotencyKey??crypto.randomUUID();if(version!=null)headers['If-Match']=String(version);}
 let response:Response;try{response=await fetch(url,{method,headers,credentials:'same-origin',cache:'no-store',signal,body:method==='GET'?undefined:JSON.stringify(body)});}catch(e){if((e as Error)?.name==='AbortError')throw e;throw new AdminApiError(503,'NETWORK_ERROR','The admin service is unreachable. No changes were made.');}
 const payload:unknown=await response.json().catch(()=>({}));
 if(!response.ok){if(response.status===401&&typeof window!=='undefined')window.location.assign('/admin/login');throw parseError(response.status,payload);}
 if(!payload||typeof payload!=='object'||!('data' in payload))throw new AdminApiError(502,'INVALID_RESPONSE','The server returned an unexpected response.');
 return payload as ApiEnvelope<T>;
}
export async function list<T>(path:string,query?:Record<string,string|number|undefined>,signal?:AbortSignal):Promise<{items:T[];meta:PageMeta}> {
 const result=await apiRequest<T[]>(path,{query,signal});
 if(!Array.isArray(result.data)||!result.meta||!Number.isFinite(result.meta.total)||!Number.isFinite(result.meta.page))throw new AdminApiError(502,'INVALID_RESPONSE','The server list response was incomplete.');
 return {items:result.data,meta:result.meta};
}
