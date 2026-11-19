import {NextResponse,type NextRequest} from 'next/server';
/** Production fail-closed. A cookie's existence is NOT authentication; every protected
 * page and every BFF request independently verifies the session with David's backend. */
export function middleware(request:NextRequest){
 const enabled=process.env.ADMIN_STAFF_INTEGRATION_ENABLED==='approved-v1'&&process.env.ADMIN_RELEASE_APPROVED==='true'&&!!process.env.ADMIN_BACKEND_URL&&!!process.env.ADMIN_STAFF_SESSION_COOKIE;
 const path=request.nextUrl.pathname.replace(/\/+$/,'')||'/';
 if(path==='/admin/login')return NextResponse.next();
 if(!enabled)return new NextResponse('Admin Portal unavailable until authenticated backend integration and release approvals are complete.',{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 // Do not authorize from middleware cookies; protected pages query backend staff session.
 return NextResponse.next();
}
export const config={matcher:['/admin/:path*']};
