import {ProtectedPage} from '@/components/admin/live/ProtectedPage';
import {getSession} from '@/lib/admin-api/server';
import {PERMISSIONS} from '@/lib/admin-api/contracts';
import {TransactionsPage} from '@/components/admin/live/TransactionsPage';
export const dynamic='force-dynamic';
export default async function Page(){const session=await getSession();return <ProtectedPage permission={PERMISSIONS.transactions}>{session&&<TransactionsPage session={session}/>}</ProtectedPage>;}
