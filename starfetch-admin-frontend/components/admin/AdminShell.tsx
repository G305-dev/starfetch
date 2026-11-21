"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {LayoutDashboard,Users,ShieldCheck,ChartNoAxesCombined,ArrowLeftRight,Layers3,Settings,Menu,X,LogOut} from 'lucide-react';
import {Logo} from '@/components/ui';
import type {StaffSession} from '@/lib/admin-api/contracts';
import {PERMISSIONS} from '@/lib/admin-api/contracts';
const links=[
 {label:'Dashboard',href:'/admin/dashboard',icon:LayoutDashboard,permission:PERMISSIONS.dashboard},
 {label:'Users & Accounts',href:'/admin/users',icon:Users,permission:PERMISSIONS.investors},
 {label:'KYC & Verification',href:'/admin/kyc',icon:ShieldCheck,permission:PERMISSIONS.kyc},
 {label:'Investments',href:'/admin/investments',icon:ChartNoAxesCombined,permission:PERMISSIONS.investments},
 {label:'Transactions',href:'/admin/transactions',icon:ArrowLeftRight,permission:PERMISSIONS.transactions},
 {label:'Portfolios',href:'/admin/portfolios',icon:Layers3,permission:PERMISSIONS.portfolios},
 {label:'Settings',href:'/admin/settings',icon:Settings,permission:PERMISSIONS.settings},
];
const pageInfo:Record<string,[string,string]>={
 '/admin/dashboard':['Admin Dashboard','Operational overview from authorized backend records.'],
 '/admin/users':['Users & Accounts','Manage registered investor accounts and invitations.'],
 '/admin/kyc':['KYC & Verification','Review submissions under compliance controls.'],
 '/admin/investments':['Investments','Investment positions and controlled instruction requests.'],
 '/admin/transactions':['Transactions','Reconciled transaction records and requests.'],
 '/admin/portfolios':['Portfolios','Investment-solution totals from the valuation service.'],
 '/admin/settings':['Settings','Authorized operational summary.'],
};
function Sidebar({session,close,logout}:{session:StaffSession;close?:()=>void;logout:()=>void}){
 const path=usePathname();return <div className="flex h-full flex-col bg-[#003a2a] text-white"><div className="mx-5 border-b border-white/25 py-7"><Logo light href="/admin/dashboard"/></div><div className="min-h-0 flex-1 overflow-y-auto px-3 py-6"><p className="mb-4 px-3 text-[10px] font-extrabold tracking-widest text-white/70">ADMIN CONSOLE</p><nav aria-label="Admin navigation" className="space-y-1">{links.filter(x=>session.permissions.includes(x.permission)).map(({label,href,icon:Icon})=><Link key={href} href={href} onClick={close} aria-current={path===href?'page':undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${path===href?'bg-star-lime text-star-900':'text-white/90 hover:bg-white/10'}`}><Icon size={18}/>{label}</Link>)}</nav></div><div className="mx-5 border-t border-white/25 py-5"><p className="truncate text-xs font-bold">{session.displayName}</p><p className="mt-1 text-[10px] text-white/70">{session.role} · Authenticated staff</p><button onClick={logout} className="mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-white/10"><LogOut size={15}/> Sign out</button></div></div>;
}
export function AdminShell({session,children}:{session:StaffSession;children:React.ReactNode}){
 const [menu,setMenu]=useState(false);const [notice,setNotice]=useState('');const router=useRouter();const path=usePathname();const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!menu)return;const handle=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(false);trigger.current?.focus();}};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);},[menu]);
 async function logout(){try{const csrf=decodeURIComponent(document.cookie.match(/(?:^|;\s*)__Host-sf_admin_csrf=([^;]*)/)?.[1]??'');const res=await fetch('/api/admin-auth/logout',{method:'POST',headers:{'X-CSRF-Token':csrf},credentials:'same-origin',cache:'no-store'});if(!res.ok){setNotice('Unable to verify logout with server. Close this browser session and contact support.');return;}}catch{setNotice('Logout unavailable; close this browser and contact support.');return;}router.replace('/admin/login');router.refresh();}
 const [title,description]=pageInfo[path]??['Admin Portal','Authorized staff workspace'];
 return <div className="min-h-screen bg-[#f8faf7] text-[#152219]"><aside className="fixed inset-y-0 left-0 hidden w-[245px] lg:block"><Sidebar session={session} logout={logout}/></aside>{menu&&<div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 w-full bg-black/50" aria-label="Close navigation" onClick={()=>setMenu(false)}/><div role="dialog" aria-modal="true" aria-label="Admin navigation" className="relative h-full w-[min(300px,85vw)]"><button aria-label="Close navigation" onClick={()=>{setMenu(false);trigger.current?.focus();}} className="absolute right-3 top-5 z-10 rounded p-2 text-white"><X/></button><Sidebar session={session} close={()=>setMenu(false)} logout={logout}/></div></div>}<div className="min-w-0 lg:ml-[245px]"><div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-7"><header className="flex items-center justify-between gap-3"><div className="flex items-start gap-3"><button ref={trigger} className="mt-1 rounded-md bg-star-900 p-2 text-white lg:hidden" aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu size={19}/></button><div><h1 className="text-[24px] font-extrabold tracking-[-.04em] text-[#101b15] sm:text-[27px]">{title}</h1><p className="mt-1 text-xs text-[#738078]">{description}</p></div></div><div className="hidden text-right text-xs text-[#536359] sm:block"><div className="font-bold">{session.displayName}</div><div>Staff session verified</div></div></header>{notice&&<p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs">{notice}</p>}<div className="mt-6">{children}</div></div></div></div>;
}
