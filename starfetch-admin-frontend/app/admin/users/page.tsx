import {ProtectedPage} from '@/components/admin/live/ProtectedPage';
import {getSession} from '@/lib/admin-api/server';
import {PERMISSIONS} from '@/lib/admin-api/contracts';
import {UsersPage} from '@/components/admin/live/UsersPage';
export const dynamic='force-dynamic';
export default async function Page(){const session=await getSession();return <ProtectedPage permission={PERMISSIONS.investors}>{session&&<UsersPage session={session}/>}</ProtectedPage>;}
