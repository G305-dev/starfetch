"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {AlertCircle,LoaderCircle,X} from 'lucide-react';
import {AdminApiError,apiRequest} from '@/lib/admin-api/client';
export const button='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-star-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-star-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-700';
export const secondary='inline-flex min-h-10 items-center justify-center rounded-lg border border-star-200 bg-white px-4 py-2.5 text-xs font-bold text-star-900 hover:bg-star-50 disabled:opacity-50';
export const input='w-full min-h-10 rounded-lg border border-[#d9e3d8] bg-white px-3 py-2 text-sm text-star-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700';
export const card='rounded-xl border border-[#e7ece7] bg-white p-4 shadow-[0_3px_12px_rgba(23,51,30,0.035)] sm:p-5';
export function Card({children,className=''}:{children:ReactNode;className?:string}){return <section className={card+' '+className}>{children}</section>}
export function State({status,message,onRetry}:{status:'loading'|'empty'|'error'|'forbidden'|'unavailable';message?:string;onRetry?:()=>void}){return <div role={status==='error'?'alert':'status'} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg p-6 text-center text-star-muted"><AlertCircle size={22} aria-hidden="true"/><p className="text-sm font-semibold text-star-900">{status==='loading'?'Loading authorized information…':status==='empty'?'No records match your filters':status==='forbidden'?'You are not authorized to view this information':status==='unavailable'?'Service unavailable':'Unable to load records'}</p>{message&&<p className="max-w-xl text-xs">{message}</p>}{onRetry&&status!=='loading'&&<button className={secondary} onClick={onRetry}>Retry</button>}</div>}
export function Th({children,className=''}:{children:ReactNode;className?:string}){return <th scope="col" className={'whitespace-nowrap bg-[#f4f8f3] px-4 py-3 text-left text-[11px] font-extrabold text-[#526157] '+className}>{children}</th>}
export function Td({children,className=''}:{children:ReactNode;className?:string}){return <td className={'px-4 py-3 text-xs text-[#263b2c] '+className}>{children}</td>}
export function Pager({page,pages,total,onPage}:{page:number;pages:number;total:number;onPage:(n:number)=>void}){return <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-star-200 pt-3 text-xs text-star-muted"><span>{total.toLocaleString()} records · Page {page} of {Math.max(1,pages)}</span><div className="flex gap-2"><button className={secondary} disabled={page<=1} onClick={()=>onPage(page-1)}>Previous</button><button className={secondary} disabled={page>=pages} onClick={()=>onPage(page+1)}>Next</button></div></div>}
export function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const before=document.activeElement as HTMLElement|null;closeRef.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')close();if(e.key==='Tab'){const list=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')??[]);if(!list.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};window.addEventListener('keydown',handler);const prior=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{window.removeEventListener('keydown',handler);document.body.style.overflow=prior;before?.focus();};},[close]);
 return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6" role="presentation"><div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-7"><div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-lg font-extrabold text-star-900">{title}</h2><button ref={closeRef} aria-label="Close dialog" onClick={close} className="rounded-lg p-1.5 hover:bg-star-50"><X size={19}/></button></div>{children}</div></div>;
}
export function KV({rows}:{rows:[string,ReactNode][]}){return <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([label,value])=><div key={label} className="rounded-lg bg-[#f6f9f4] p-3"><dt className="text-[11px] text-star-muted">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-star-900">{value??'Not available'}</dd></div>)}</dl>}
export function useRemote<T>(path:string,query:Record<string,string|number|undefined>={},active=true,revision=0){
 const [state,setState]=useState<{key:string;status:'loading'|'success'|'error';value?:T;error?:AdminApiError}>({key:'',status:'loading'});
 const [refresh,retry]=useState(0);const key=JSON.stringify(query);const requestKey=`${path}?${key}#${revision}:${refresh}`;
 useEffect(()=>{if(!active)return;const controller=new AbortController();setState({key:requestKey,status:'loading'});
 apiRequest<T>(path,{query:JSON.parse(key) as Record<string,string|number|undefined>,signal:controller.signal}).then(v=>setState({key:requestKey,status:'success',value:v.data})).catch(e=>{if((e as Error).name!=='AbortError')setState({key:requestKey,status:'error',error:e instanceof AdminApiError?e:new AdminApiError(503,'NETWORK_ERROR','Service unavailable')});});
 return()=>controller.abort();},[path,key,active,requestKey]);
 return {...(state.key===requestKey?state:{key:requestKey,status:'loading' as const}),retry:()=>retry(n=>n+1)};
}
export function Load({status,error,retry}:{status:'loading'|'error'|'success';error?:AdminApiError;retry:()=>void}){if(status==='success')return null;return <State status={status==='loading'?'loading':error?.status===403?'forbidden':error?.status===503?'unavailable':'error'} message={error?.message} onRetry={status==='error'?retry:undefined}/>}
export function Submit({saving,children}:{saving:boolean;children:ReactNode}){return <button type="submit" disabled={saving} className={button}>{saving&&<LoaderCircle size={15} className="animate-spin"/>}{children}</button>}
export function useNotice(){const [message,setMessage]=useState<string|null>(null);return {message,setMessage,view:message?<p role="status" className="mb-4 rounded-lg border border-star-200 bg-star-50 p-3 text-xs text-star-900">{message}</p>:null};}
export function usePaged<T>(path:string,query:Record<string,string|number|undefined>,revision=0){
 type Result={key:string;status:'loading'|'success'|'error';items:T[];meta:{page:number;pageSize:number;total:number;totalPages:number};error?:AdminApiError};
 const emptyMeta={page:1,pageSize:20,total:0,totalPages:1};
 const [state,setState]=useState<Result>({key:'',status:'loading',items:[],meta:emptyMeta});
 const [refresh,retry]=useState(0);const key=JSON.stringify(query);const requestKey=`${path}?${key}#${revision}:${refresh}`;
 useEffect(()=>{const controller=new AbortController();setState({key:requestKey,status:'loading',items:[],meta:emptyMeta});
 apiRequest<T[]>(path,{query:JSON.parse(key) as Record<string,string|number|undefined>,signal:controller.signal}).then(response=>{
 if(!Array.isArray(response.data)||!response.meta)throw new AdminApiError(502,'INVALID_RESPONSE','Paginated response is incomplete');
 setState({key:requestKey,status:'success',items:response.data,meta:response.meta});
 }).catch(e=>{if((e as Error).name!=='AbortError')setState({key:requestKey,status:'error',items:[],meta:emptyMeta,error:e instanceof AdminApiError?e:new AdminApiError(503,'NETWORK_ERROR','Service unavailable')});});
 return()=>controller.abort();},[path,key,requestKey]);
 return {...(state.key===requestKey?state:{key:requestKey,status:'loading' as const,items:[],meta:emptyMeta}),retry:()=>retry(n=>n+1)};
}
export function ErrorNotice({error}:{error:string}){return <p role="alert" className="my-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800">{error}</p>}
