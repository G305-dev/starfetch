import {redirect} from 'next/navigation';
import {getSession,liveConfig} from '@/lib/admin-api/server';
import type {Permission} from '@/lib/admin-api/contracts';
import {AdminShell} from '@/components/admin/AdminShell';
import {AlertTriangle} from 'lucide-react';
export async function ProtectedPage({permission,children}:{permission:Permission;children:React.ReactNode}){
 if(!liveConfig())return <div className="mx-auto mt-24 max-w-xl rounded-xl border border-amber-200 bg-white p-8 text-center"><AlertTriangle className="mx-auto mb-3 text-amber-700"/><h1 className="text-xl font-bold text-star-900">Admin integration unavailable</h1><p className="mt-3 text-sm text-star-muted">Secure staff authentication and backend integration have not yet been approved. No records are displayed.</p></div>;
 const session=await getSession();if(!session)redirect('/admin/login');
 if(!session.permissions.includes(permission))return <div className="mx-auto mt-24 max-w-xl rounded-xl border border-red-200 bg-white p-8 text-center"><h1 className="text-xl font-bold">Access denied</h1><p className="mt-3 text-sm">Your staff account is not authorized to view this section.</p></div>;
 return <AdminShell session={session}>{children}</AdminShell>;
}
