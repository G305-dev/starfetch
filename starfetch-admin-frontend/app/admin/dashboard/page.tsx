import {ProtectedPage} from '@/components/admin/live/ProtectedPage';
import {PERMISSIONS} from '@/lib/admin-api/contracts';
import {DashboardPage} from '@/components/admin/live/DashboardPage';
export const dynamic='force-dynamic';
export default function Page(){return <ProtectedPage permission={PERMISSIONS.dashboard}><DashboardPage/></ProtectedPage>;}
