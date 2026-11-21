/** Login uses a standalone layout. Each protected page verifies staff session
 * and permission through ProtectedPage before the admin shell is rendered. */
export default function AdminLayout({children}:{children:React.ReactNode}){return <>{children}</>;}
