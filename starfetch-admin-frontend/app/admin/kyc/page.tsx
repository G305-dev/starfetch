import {ProtectedPage} from '@/components/admin/live/ProtectedPage';
import {getSession} from '@/lib/admin-api/server';
import {PERMISSIONS} from '@/lib/admin-api/contracts';
import {KycPage} from '@/components/admin/live/KycPage';
export const dynamic='force-dynamic';
export default async function Page(){const session=await getSession();return <ProtectedPage permission={PERMISSIONS.kyc}>{session&&<KycPage session={session}/>}</ProtectedPage>;}
