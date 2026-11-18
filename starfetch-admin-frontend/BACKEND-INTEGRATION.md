# Backend integration dependencies

All points below are **BACKEND CONTRACT REQUIRED**. David and the security, finance and compliance owners must agree the contracts before production use. This frontend does not currently connect to an admin API or database.

1. **Staff authentication/authorization:** approved staff sign-in, session, logout and server-side permission checks on every admin page and API. The middleware currently returns 503 and is a fail-closed blocker, not authentication. Preserve existing secure Starfetch session/refresh/CSRF conventions when the contract is approved; never persist tokens in localStorage.
2. **Admin reads:** authorized, paginated dashboard, users, investments, KYC, transactions, portfolios and settings data with defined search, filtering, error and empty states. Define currency precision, dates, as-of/source metadata and unknown values. Do not derive AUM, return or valuation from demo data.
3. **KYC:** approved read-only list/detail and authorized document access with redaction; no automatic ID verification, sanctions/AML/PEP screening or decision is implemented.
4. **Transaction editing:** a separate approved endpoint and field whitelist, backend authorization, validation, confirmed response and audit logging are required. Demo Edit updates one descriptive fixture field only in memory; it never accesses the backend and does not authorize real edits.
5. **Other actions/settings:** financial processing, approvals, notifications and settings/role changes require distinct approved contracts and business/compliance/security sign-off. Preview buttons do not perform them.

The `ADMIN_DEMO_MODE=1` development-only preview is intentionally unauthenticated and serves synthetic fixtures, never production data. Do not expose it publicly, connect real APIs to it or enter real credentials. Production ignores the flag and fails closed until real backend authorization is implemented.
