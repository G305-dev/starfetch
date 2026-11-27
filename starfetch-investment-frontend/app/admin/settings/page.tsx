import {ProtectedPage} from '@/components/admin/live/ProtectedPage';
import {PERMISSIONS} from '@/lib/admin-api/contracts';
import {SettingsPage} from '@/components/admin/live/SettingsPage';
export const dynamic='force-dynamic';
export default function Page(){return <ProtectedPage permission={PERMISSIONS.settings}><SettingsPage/></ProtectedPage>;}
