# STARFETCH D-06 — Corporate Dashboard Frontend Update

**Status:** Frontend-only mock-data synchronization record  
**Owner:** Emmanuel — Frontend / Investor Portal  
**Scope:** Verified Corporate Investor Dashboard at `/corporate/dashboard`.

## Purpose

This update records the frontend data groups prepared for a future corporate-dashboard backend integration. The implemented dashboard uses local mock data only; no API, authentication, document-download, funding, messaging, or transaction-processing workflow is added.

## Future data groups

| Frontend group | Current local content | Future backend purpose |
|---|---|---|
| `company` | Company name, initials, account label | Corporate account identity and display settings |
| `accountStatus` | Verification-complete label/state | Corporate account and verification status |
| `summaryMetrics` | Total invested, portfolio value, return to date, available cash | Corporate portfolio summary response |
| `portfolioSeries` | Jan–Jun 2024 portfolio values | Portfolio valuation chart series |
| `investments` | Fixed Note, Discretionary Portfolio, Execution Mandate | Corporate investment portfolio rows |
| `recentActivity` | Two completed investment activities | Corporate activity/transaction history |
| `documents` | Latest Statement, Company Verification | Document/request inventory and permissions |
| `quickActions` | Add Funds, View Statement, Contact Relationship Manager | Future permitted corporate actions |

## Approved mock display values

- Total Invested: `₦25,000,000`
- Current Portfolio Value: `₦25,684,250`
- Return to Date: `+2.74%`
- Available Cash: `₦0.00`
- Fixed Note: `₦15,000,000`, Active, `18 Dec 2026`
- Discretionary Portfolio: `₦7,000,000`, Active, Ongoing
- Execution Mandate: `₦3,000,000`, Pending funding

## Backend impact

**Future backend impact: yes.** A later approved integration must define authorized corporate access, corporate identity, verification status, portfolio data, transaction/activity data, documents, action permissions, error handling, and loading states. This frontend update does not define or call an endpoint.

## Out of scope

No real funding, live calculations, transaction processing, statement downloads, relationship-manager messaging, bank integration, corporate KYC workflow, or document API is approved or implemented by this update.
