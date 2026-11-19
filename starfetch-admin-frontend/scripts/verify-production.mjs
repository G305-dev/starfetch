/** Dependency-free static regression checks for the Starfetch Admin production integration.
 * These are NOT runtime/E2E/backend security tests. */
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const read=(path)=>readFileSync(join(root,path),'utf8');
const rows=[['dashboard','DashboardPage'],['users','UsersPage'],['kyc','KycPage'],['investments','InvestmentPage'],['transactions','TransactionsPage'],['portfolios','PortfolioPage'],['settings','SettingsPage']];
for(const [route,component] of rows){const p=read(`app/admin/${route}/page.tsx`);assert.match(p,/ProtectedPage/);assert.ok(p.includes(component));assert.doesNotMatch(p,/demo\/|admin-demo-mode/);}
assert.ok(!existsSync(join(root,'components/admin/demo')),'runtime demo directory must be removed');
assert.ok(!existsSync(join(root,'lib/admin-demo-mode.ts')),'demo mode gate must be removed');
assert.ok(!existsSync(join(root,'components/admin/login/admin-login-validation.ts')),'demo credentials validator must be removed');
const middleware=read('middleware.ts');assert.match(middleware,/ADMIN_RELEASE_APPROVED/);assert.match(middleware,/status:503/);
const bff=read('app/api/admin-gateway/[...segments]/route.ts');assert.match(bff,/csrf/i);assert.match(bff,/getSession/);assert.match(bff,/permission/i);assert.ok(!/\/investment-requests.*\/approve/.test(bff));assert.ok(!/\/transaction-requests.*\/approve/.test(bff));
const account=read('components/admin/live/AccountPicker.tsx');assert.match(account,/accounts\/search/);assert.match(account,/eligibility/);assert.match(account,/User not found/);
const inv=read('components/admin/live/InvestmentPage.tsx');assert.match(inv,/investment-requests/);assert.doesNotMatch(inv,/documents|activity log/i);
const txn=read('components/admin/live/TransactionsPage.tsx');assert.match(txn,/transaction-requests/);assert.match(txn,/ACCOUNT_NOT_FOUND|AccountPicker/);
const portfolio=read('components/admin/live/PortfolioPage.tsx');assert.match(portfolio,/portfolios\/by-solution/);assert.match(portfolio,/Investment Solution/);assert.match(portfolio,/Amount Invested/);assert.match(portfolio,/Current Value/);assert.doesNotMatch(portfolio,/Recent Portfolio Activities/);
const login=read('components/admin/login/AdminLoginForm.tsx');assert.doesNotMatch(login,/demo@example.com|demo-only|Open demo/);
const client=read('lib/admin-api/client.ts');assert.doesNotMatch(client,/localStorage|sessionStorage/);
console.log(`PASS ${rows.length} protected page routes, fail-closed auth gate, no demo fixtures/credentials, BFF access control, account lookup and controlled financial request routes`);
