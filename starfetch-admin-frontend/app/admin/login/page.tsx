import type {Metadata} from 'next';
import {AdminLoginBrandPanel} from '@/components/admin/login/AdminLoginBrandPanel';
import {AdminLoginHeader} from '@/components/admin/login/AdminLoginHeader';
import {AdminLoginForm} from '@/components/admin/login/AdminLoginForm';
import {liveConfig} from '@/lib/admin-api/server';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Staff Sign In | Starfetch Investment Limited',robots:{index:false,follow:false}};
export default function Login(){return <main className="min-h-screen bg-[#f1f6f2] text-star-900"><AdminLoginHeader/><div className="grid min-h-[calc(100vh-68px)] md:grid-cols-[minmax(0,43fr)_minmax(0,57fr)] lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]"><AdminLoginBrandPanel/><section className="flex min-w-0 items-center justify-center px-4 py-8 sm:px-8 lg:px-12" aria-label="Staff authentication"><AdminLoginForm enabled={!!liveConfig()}/></section></div></main>}
