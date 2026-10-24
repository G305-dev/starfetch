# STARFETCH — FRONTEND ↔ BACKEND COMPATIBILITY MAP

> **Status:** DRAFT — REQUIRES TEAM APPROVAL  |  **Review outcome:** ACCEPTED WITH CORRECTIONS (corrections applied in this revision)
> **D-06:** **v1 — BASELINE ESTABLISHED / LIVING FRONTEND-BACKEND REQUIREMENTS HANDOFF** (change-controlled; future updates arrive as v1.1+ — see §4).
> **Purpose:** Map Emmanuel's **existing** frontend (`starfetch-investment-frontend/`: Next.js 15.5.9, React 19, TypeScript, Tailwind, Lucide) to future backend dependencies — without modifying it. This is David-side dependency documentation; adoption of any API by the frontend is Emmanuel's decision and timing.
> **Classifications used:** `STATIC FRONTEND` • `BACKEND API PLANNED — FRONTEND ADOPTION COORDINATED` • `FUTURE EXTERNAL INTEGRATION` • `FUTURE PORTAL FEATURE` • `NOT CURRENTLY ACTIVE`

---

## 1. Existing public site (routes `/`, `/about`, `/services`)

| # | Frontend area | Classification | Backend dependency & notes |
|---|---|---|---|
| 1 | **Homepage overall** (HeroSection, ValueProposition, CompanyCredentials, WhoWeAre, OurValues, WhyStarfetch, PersonalApproach, CTASection, Footer) | **STATIC FRONTEND** | Marketing copy, layout, imagery and page composition remain local. No API proposed for these sections; building CMS/database complexity for static prose adds cost with no MVP benefit. |
| 2 | **Navbar / Footer / navigation labels** | **STATIC FRONTEND** | Labels and links are presentation constants. Portal entry links will later target the investor/staff portal (Future portal feature; routing unchanged today). |
| 3 | **MarketTicker** | **FUTURE EXTERNAL INTEGRATION** | Displays NGX ASI, USD/NGN, T-Bills, FGN Bonds, selected equities, Inflation, MPR, CRR as placeholders (`—`). **No live feed exists; none may be fabricated.** A future `MarketDataProvider` (approved separately) would back a `/api/v1/public/market-*` boundary. Until then, placeholder behavior must remain exactly as-is. |
| 4 | **InvestmentServices section (three solutions)** | **BACKEND API PLANNED — FRONTEND ADOPTION COORDINATED** | Proposed `GET /api/v1/public/investment-solutions` serves the three frozen solutions (`fixed-note`, `discretionary-portfolios`, `execution-mandate`) with descriptive fields only. Rationale for backend-sourced: solution descriptions are business content that portal, mobile and future channels must render identically; one seed of record prevents drift. **Adoption is coordinated, not required:** Emmanuel's working static implementation remains valid and is NOT required to be replaced immediately. If/when coordinated adoption happens, the contract is already compatible with the three existing names/slugs — never a breaking change. Homepage anchor ids (`service-fixed-note`, etc.) are Emmanuel's DOM concern and stay untouched. |
| 5 | **MarketOverview section** | **FUTURE EXTERNAL INTEGRATION** | Same rule as MarketTicker: placeholders remain; no market numbers fabricated; future provider-backed boundary only. |
| 6 | **FreeTools** (Budget Planner, Portfolio Allocation Tool, Returns Calculator) | **STATIC FRONTEND (now) → FUTURE PORTAL FEATURE (only if approved)** | Presentational today; **no calculation APIs in Phase 1 and no formulas invented.** If the team later wants working tools, the calculation rules must be supplied through product/compliance decision first; only then would an approved endpoint exist. |
| 7 | **Open an Account** | **FUTURE PORTAL FEATURE** | Currently anchors within the site. Future lifecycle: portal registration (`POST /api/v1/auth/register`, DRAFT — D-06 v1 fields `firstName` / `lastName` / `email` / `password`; password confirmation stays in the UI only) → onboarding application including **investment-solution selection** (selection only, not a purchase; #10–#14 in the contract draft). Frontend button is not changed in this phase. |
| 8 | **Sign Up** | **FUTURE PORTAL FEATURE** | Same future registration contract as above (DRAFT — authentication direction approved; registration fields per **D-06 v1 baseline**: `firstName`, `lastName`, `email`, `password`; `confirmPassword` remains frontend-only). **"Continue with Google" / "Continue with Apple" remain non-functional frontend placeholders — `FUTURE AUTHENTICATION INTEGRATION — NOT MVP`; no OAuth backend work exists.** Field updates beyond v1 arrive as D-06 v1.1+. |
| 9 | **Start Investing** | **FUTURE PORTAL FEATURE** | Same flow as Open an Account. |
| 10 | **Speak with an Adviser** | **STATIC FRONTEND** | Contact anchor; no API dependency in MVP. |
| 11 | **`/services` page** | **STATIC FRONTEND** (marketing detail) | Service detail copy stays local. Kept *compatible* with the solutions contract via the frozen slugs, so a future deep-link pattern (`/services#fixed-note` or `/services/fixed-note`) can resolve without renaming anything. |
| 12 | **`/about` page** | **STATIC FRONTEND** | Company copy; no API dependency. |
| 13 | **FAQSection** | **STATIC FRONTEND** | Q&A copy is editorial; no API in MVP. |
| 14 | **MarketDigest component** | **NOT CURRENTLY ACTIVE** | Exists in the codebase but is **not part of the active homepage tree**. **No newsletter endpoint is built in Phase 1.** Recorded as a potential future public dependency (`POST /api/v1/public/newsletter-subscriptions`) that would sit behind consent capture and a future `NotificationProvider`. It must not be implemented "because the component exists." |

---

## 2. Future portal surfaces (do not exist yet — dependencies only)

| # | Surface | Classification | Backend dependencies (contract draft refs) |
|---|---|---|---|
| 15 | **Investor portal (web)** | **FUTURE PORTAL FEATURE** | Auth (#3–7), profile (#8–9, split-name per D-06 v1), applications incl. **investment-solution selection** (#10–14), documents (#15–17), products (#18), portfolio/transactions/statements (#19–22 — statements with `displayName`; all sample data carry persistent synthetic indicators). Dashboard composites per **D-06 v1**: application status, optional profile completion (calculation unapproved), solution discovery, sample portfolio/holdings, recent sample transactions, statements. Day mapping: Days 4, 6, 7. Status transitions remain **D-08 — OPEN**. |
| 16 | **Staff/admin portal (web)** | **FUTURE PORTAL FEATURE** | Staff endpoints (#23–31): investor list/detail — minimal list shows investor name, email, application status, **`submittedAt`** (derived from `applications.submitted_at`; no duplicate storage — D-06 v1) and a view action; review queue, notes, transitions (map pending **D-08**), document review/download, audit display. Day 8. |
| 17 | **Android app** | **FUTURE PORTAL FEATURE** | **The same v1 contracts.** No Android-specific business APIs. Days 11–15. |
| 18 | **iPhone/iOS app** | **FUTURE PORTAL FEATURE** | **The same v1 contracts.** No iOS-specific business APIs. Days 11–15. |

---

## 3. Compatibility commitments from the backend side

1. **No renames, no removals, no inventions:** the three solutions' names and slugs are frozen in the backend seed design to match the frontend exactly; no rates, yields, fees, tenors, minimums, liquidity, maturity, guarantee or settlement terms appear anywhere.
2. **No frontend edits:** Phase 1 (and all David work) adds a *separate* backend layer; `starfetch-investment-frontend/` is never modified, restyled, rerouted or converted.
3. **Placeholders stay truthful:** market sections keep their `—` placeholders until a team-approved market-data provider exists.
4. **Client-neutral contracts:** every contract above works identically for browser and native clients, so Days 11–15 need no rework.
5. **Graceful degradation for public content:** the public site must remain fully renderable even if the API is unreachable — solutions data has a documented static fallback during transition; nothing on the public site hard-depends on live backend availability in MVP.

## 4. D-06 status — v1 baseline received (living handoff)

Decision **D-06** in `STARFETCH-PHASE-1-DECISIONS-NEEDED.md` is now **BASELINE ESTABLISHED (v1) — LIVING FRONTEND-BACKEND REQUIREMENTS HANDOFF**.

**Delivered in v1:** registration fields (`firstName`, `lastName`, `email`, `password`; confirmation stays in the UI); profile fields (split name; optional phone); onboarding investment-solution selection (three frozen slugs; selection only); statement display needs (period, `displayName`, sample indicator, view/download); dashboard sample-data needs; minimal staff investor-list needs (name, email, application status, `submittedAt`, view action); confirmation that "Continue with Google" / "Continue with Apple" stay **non-functional placeholders**.

**Still outstanding for later D-06 versions (v1.1+):** document categories expected by the upload UI (contract approval), consent/legal text (currently **unapproved**), email-edit behaviour (frontend/backend coordination decision), profile-completion calculation (**unapproved**), and any further onboarding/detail fields.

**Change control:** each new D-06 version affecting data/API requirements is compared against the canonical contract; added/removed/renamed fields, validation, responses, database impact and compatibility are identified; approved contracts never change silently; coordinated change control precedes implementation. **Pure visual changes need no API/database changes.**
