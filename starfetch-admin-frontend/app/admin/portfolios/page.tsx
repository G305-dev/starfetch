import {ProtectedPage} from '@/components/admin/live/ProtectedPage';
import {PERMISSIONS} from '@/lib/admin-api/contracts';
import {PortfolioPage} from '@/components/admin/live/PortfolioPage';
export const dynamic='force-dynamic';
export default function Page(){return <ProtectedPage permission={PERMISSIONS.portfolios}><PortfolioPage/></ProtectedPage>;}
