# STARFETCH D-06 v1 — BASELINE FRONTEND REQUIREMENTS

**Purpose:** living frontend → backend synchronization record for the staging MVP portal. It records the baseline frontend requirements synchronized in D-06 v1, while preserving clearly marked proposed and business/compliance-open items.  
**Scope:** investor web portal, staff/admin web portal, and the future React Native mobile UI consuming the same approved concepts.  
**Boundary:** this is **not** code, an API design, a database model, an authentication design, or a compliance decision. No project files were changed to produce this update.  
**Document status:** D-06 v1 is a baseline, not a permanently closed document. Subsequent backend-affecting frontend changes use an incremental D-06 update (for example v1.1 or v1.2; v2 for a major change).

## Status convention

- **BASELINE — SYNCHRONIZED**: a D-06 v1 frontend requirement explicitly synchronized in this update. It still does not prescribe backend implementation architecture.
- **PROPOSED — EMMANUEL REVIEW REQUIRED**: an ordinary, minimal UI proposal that Emmanuel may approve, revise, or remove.
- **BUSINESS / COMPLIANCE INPUT REQUIRED**: a field, label, declaration, document, workflow rule, or content that developers must not decide independently. Where it appears in a table, it is also a proposal for review—not an approval.
- **NON-FUNCTIONAL PLACEHOLDERS — FUTURE APPROVAL/INTEGRATION REQUIRED**: visible UI placeholders only. They do not create an authentication/integration requirement.
- “Suggested Client Field” is only a stable frontend form/display key to support UI design. It does **not** prescribe a backend property, database column, endpoint payload, or persistence rule.

## D-06 CHANGE CONTROL

D-06 v1 remains a living frontend → backend synchronization record. Emmanuel should issue an incremental D-06 update whenever a frontend decision changes backend data, API responses, validation, permissions, or workflows. Examples include changes to:

- Registration fields or login data requirements.
- Profile or application/onboarding fields.
- Consent controls or document categories.
- Dashboard, transaction, or statement fields.
- Staff/admin columns, actions, or application-status display.
- Validation requirements, permissions, or other backend-dependent UI behaviour.

Pure visual changes—such as colours, spacing, fonts, imagery, or animations—do not require a D-06 update unless they change backend data requirements.

Each update should include:

1. D-06 version.
2. What changed.
3. Previous requirement.
4. New requirement.
5. Why it changed.
6. Backend impact expected: **YES / NO / UNKNOWN**.

Use a small incremental update (for example **D-06 v1.1** or **D-06 v1.2**) where practical. Use **D-06 v2** for a major change. Do not regenerate the entire document for every small update unless needed.

---

## MVP guardrails carried into this proposal

- No live BVN, NIN, KYC, AML/PEP, payment, bank, market-data, custodian, broker, or notification integration.
- No IMS, NAV, ledger, settlement, reconciliation, treasury, trade-management, or accounting UI.
- Portfolio, holdings, transactions, and statements are **sample/synthetic** staging-MVP displays only.
- The approved public solution names remain exactly:
  - **Starfetch Fixed Note**
  - **Starfetch Discretionary Portfolios**
  - **Starfetch Execution Mandate**

---

## 1. Registration Screen

### Proposed smallest practical investor-registration form

| UI Label | Suggested Client Field | Input Type | Required? | Frontend Validation | Status |
|---|---|---|---|---|---|
| First name | `firstName` | Text | Yes | Required; trim surrounding whitespace; clear inline message if empty. | **BASELINE — SYNCHRONIZED** |
| Last name | `lastName` | Text | Yes | Required; trim surrounding whitespace; clear inline message if empty. | **BASELINE — SYNCHRONIZED** |
| Email address | `email` | Email | Yes | Required; native email input plus clear valid-email-format message. | **BASELINE — SYNCHRONIZED** |
| Password | `password` | Password with show/hide control | Yes | Required. Show any approved password-rule feedback once supplied; do not invent a policy in the UI. | **BASELINE — SYNCHRONIZED** |
| Confirm password | `confirmPassword` | Password with show/hide control | Yes | Required; must match the Password input; this is a frontend confirmation field. | **BASELINE — SYNCHRONIZED** |

### Proposed registration interaction requirements

| UI item | Baseline behaviour | Status |
|---|---|---|
| Primary CTA | `Create account` | **BASELINE — SYNCHRONIZED** |
| Existing-account link | `Already have an account? Sign in` linking to `/login`. | **BASELINE — SYNCHRONIZED** |
| Password visibility | Eye/EyeOff control for Password and Confirm password, with accessible labels. | **BASELINE — SYNCHRONIZED** |
| Error-message placement | Inline, immediately beneath the related field; retain the entered non-sensitive value where appropriate. | **BASELINE — SYNCHRONIZED** |
| Disabled-submit behaviour | Disable the CTA while required client-side fields are clearly invalid or while a submission is in progress; retain an accessible reason/state. | **BASELINE — SYNCHRONIZED** |
| Loading state | CTA changes to `Creating account…`; prevent duplicate submission; inputs/control state is visually clear. | **BASELINE — SYNCHRONIZED** |
| Successful-registration destination | Show a success confirmation and route to `/login` with an instruction to sign in. This is a UI baseline only and does not select automatic-login/session behaviour. | **BASELINE — SYNCHRONIZED**; **DAVID + EMMANUEL MUST AGREE** on the response/result that drives it. |

**Deliberately excluded from initial registration:** phone number, address, date of birth, nationality, identity-document details, bank/payment data, tax data, beneficial ownership, risk/suitability answers, and product/mandate terms.

---

## 2. Login Screen

The existing `/login` frontend mockup provides a suitable visual entry point. The following is the minimal login UI contract to review; it does not prescribe authentication implementation.

| UI Label / Element | Suggested Client Field or UI state | Input / Control | Frontend Validation / Behaviour | Status |
|---|---|---|---|---|
| Email Address | `email` | Email | Required; valid-email-format feedback placed below the field. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Password | `password` | Password | Required; show/hide password control with accessible label. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Primary CTA | `Sign In` | Submit button | Disabled while required fields are empty/invalid or during submission; loading text `Signing in…`. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Invalid-credentials state | Form-level non-sensitive message such as `We could not sign you in with those details. Please try again.` | Alert/message | Do not state which credential was incorrect. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; **DAVID + EMMANUEL MUST AGREE** on error response mapping. |
| Sign-up link | `Create an account` → `/register` | Link | Present below form/on the introduction area. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Forgot-password link | `Forgot password?` → `/forgot-password` | Link | Visible beneath Password; no reset process is implied by the link alone. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Social sign-in buttons | `Continue with Google` / `Continue with Apple` | Placeholder buttons | Keep visible and clearly non-functional. They must not trigger OAuth, imply working social authentication, create OAuth endpoints, create provider configuration, or create new backend requirements. | **BASELINE — SYNCHRONIZED** · **NON-FUNCTIONAL PLACEHOLDERS — FUTURE APPROVAL/INTEGRATION REQUIRED** |

**Password recovery:** the link and a future reset-request screen are reasonable UI placeholders, but any email delivery, verification, expiry, reset success/error outcome, or account-security workflow is **BUSINESS / COMPLIANCE INPUT REQUIRED** and requires David/Emmanuel coordination before implementation.

---

## 3. Investor Profile Screen

### Basic Profile

This screen should favour a small editable profile over a second onboarding/KYC form. Email can initially be displayed as account contact information; whether it is editable is a product/security decision for coordination.

| UI Label | Suggested Field | Display/Edit | Required? | Status |
|---|---|---|---|---|
| First name | `firstName` | Display and edit | Yes | **BASELINE — SYNCHRONIZED** |
| Last name | `lastName` | Display and edit | Yes | **BASELINE — SYNCHRONIZED** |
| Email address | `email` | Display; edit control only if an approved account-change flow exists | Yes | **BASELINE — SYNCHRONIZED**; edit behaviour requires **DAVID + EMMANUEL MUST AGREE**. |
| Mobile phone number | `phoneNumber` | Display and edit where collected/approved | No at registration; may be requested in onboarding | **BASELINE — SYNCHRONIZED**; collection/requiredness remains **BUSINESS / COMPLIANCE INPUT REQUIRED** where applicable. |
| Profile completion | `profileCompletion` / `missingProfileSections` | Display-only progress or checklist, if retained | No | **PROPOSED — EMMANUEL REVIEW REQUIRED**; exact calculation/data source requires **DAVID + EMMANUEL MUST AGREE**. |

### Information requiring Business/Compliance confirmation

No field in this table is approved for the profile. These are deliberately isolated so they are not silently built into an ordinary profile screen.

| UI Label | Suggested Field | Display/Edit | Required? | Status |
|---|---|---|---|---|
| Residential address | `residentialAddress` | Proposed display/edit section only if required | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Date of birth | `dateOfBirth` | Proposed display/edit only if required | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Nationality / residency | `nationality` / `residency` | Proposed display/edit only if required | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Identity-document information | `identityDocument` | Do not add until approved | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Tax information | `taxInformation` | Do not add until approved | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Organisation, representative, or beneficial-owner information | `organisationDetails` / `beneficialOwnership` | Do not add until approved | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Investment goals, risk preference, horizon, or suitability information | `investmentProfile` | Do not add as a profile field until approved | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |

---

## 4. Application / Onboarding Screen

### Proposed information architecture

The following six-step sequence is a **PROPOSED — EMMANUEL REVIEW REQUIRED** UI flow. It can be shortened, reordered, or replaced once the business/compliance journey is agreed.

| Proposed step | Fields / components for Emmanuel to design | Status |
|---|---|---|
| 1. Basic information | Confirm First name, Last name, Email address, and Mobile phone number where collected/approved; show an `Edit profile` link where permitted. Do not repeat full registration unnecessarily. | **BASELINE — SYNCHRONIZED** |
| 2. Application details | `Select an investment solution` using the three approved solution names; short explanatory text and a `Learn more` link to the existing Services content. This is solution selection only—not a trade order, investment mandate, investable-product purchase, or live investment execution. No rates, fees, tenors, minimum amounts, returns, suitability, or mandate terms. | **BASELINE — SYNCHRONIZED** |
| 3. Documents | Configurable document-request list; upload controls, file status, and a `Continue when requested documents are complete` state. See Section 5. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; fixed requirements are **BUSINESS / COMPLIANCE INPUT REQUIRED**. |
| 4. Consent / declarations | Reserved panel that renders only approved consent/declaration text and checkboxes. Do not write legal/regulatory language into the UI yet. | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| 5. Review | Read-only summary of profile confirmations, selected solution, uploaded/requested documents, and approved declarations; Back links per section. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| 6. Submit | `Submit application` CTA, acknowledgement/loading state, then submitted-for-review status screen. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; success/status response requires **DAVID + EMMANUEL MUST AGREE**. |

### Field-level boundary for the proposed flow

| Candidate item | Treatment in MVP UI | Status |
|---|---|---|
| Selected investment solution | Minimal application-selection control for **Starfetch Fixed Note**, **Starfetch Discretionary Portfolios**, or **Starfetch Execution Mandate**. It is solution selection only; it is not a trade order, investment mandate, purchase, or live execution. | **BASELINE — SYNCHRONIZED** |
| Free-text note / question | Exclude by default; add only if Emmanuel judges a small applicant message useful. No investment instruction should be inferred from it. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Investment suitability / risk assessment | Do not add fields, scores, or result labels until content and use are approved. | **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| KYC / identity questions | Do not add. | **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Regulatory declarations | Do not draft or add. | **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Beneficial ownership / entity representation | Do not add. | **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Tax information | Do not add. | **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Investment mandate, investment amount, allocation, limit, or instruction | Do not add. | **BUSINESS / COMPLIANCE INPUT REQUIRED** |

---

## 5. Document Upload UI

### Proposed document slots

The UI can safely support a configurable request list without declaring any document to be an approved regulatory requirement. “Required?” is intentionally not decided for compliance-sensitive categories.

| UI Document Label | Proposed Category | Required? | Status |
|---|---|---|---|
| Requested supporting document | General document requested for this application; label/instruction supplied by the approved application configuration. | Conditional / configured | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Other supporting document | Optional applicant attachment when a clear business purpose is approved. | No | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Identity / verification document | Potential identity/verification category only. | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Proof of address | Potential address-verification category only. | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |
| Organisation / authority document | Potential organisation, representative, or authority category only. | Unknown | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |

### Proposed upload interaction requirements

| UI requirement | Proposed frontend behaviour | Status |
|---|---|---|
| Select file | Per requested document card, provide a labelled file picker and show the selected filename. Accepted file formats and size limits must come from approved requirements/configuration. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; format/size rules are **BUSINESS / COMPLIANCE INPUT REQUIRED** where driven by document policy. |
| Upload progress | Show queued/uploading progress and block duplicate selection/submission for that card while active. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Upload success | Show a clear uploaded state with filename and successful timestamp/confirmation when available. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; returned metadata requires **DAVID + EMMANUEL MUST AGREE**. |
| Upload failure | Place a non-sensitive error under the affected document card; provide Retry or Replace when safe. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; error shape requires **DAVID + EMMANUEL MUST AGREE**. |
| Replace | Provide `Replace file` only when the application/document state allows it. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; permission/status policy is **BUSINESS / COMPLIANCE INPUT REQUIRED**. |
| View / download | Provide action only for files the current investor/staff role is authorised to access. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; access rule requires **DAVID + EMMANUEL MUST AGREE**. |
| Review status | Reserve a plain badge/status location on each document card. Exact labels, reviewer actions, and investor visibility must be approved before use. | **PROPOSED — EMMANUEL REVIEW REQUIRED** · **BUSINESS / COMPLIANCE INPUT REQUIRED** |

No storage vendor, Firebase design, malware/security implementation, file-retention rule, or server-side access policy is selected here.

---

## 6. Investor Dashboard

All data in this section is synthetic/sample staging data. No live values, payment balances, live returns, trading, or investment calculations are proposed.

| Dashboard Section | Data Shown | Backend Data Needed | Status |
|---|---|---|---|
| Application status | Current display label, short explanatory message, and last-updated date/time if available. | Current application UI status, approved display text, updated timestamp. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; status contract requires **DAVID + EMMANUEL MUST AGREE**. |
| Profile completion (optional) | A simple completion prompt/checklist such as `Complete your profile`, not a regulatory score. | Completion flag or list of missing approved sections. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; calculation requires **DAVID + EMMANUEL MUST AGREE**. |
| Solution discovery | The three approved solution names, existing public descriptions/risk copy, and a `Learn more` link. | None for a static staging display; if API-fed later, approved title/description/risk content only. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Sample portfolio summary | Prominent `Sample / illustrative data` label, portfolio name/label, and as-of date when supplied. | Sample flag, display title, as-of date. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; sample-data contract requires **DAVID + EMMANUEL MUST AGREE**. |
| Sample holdings | Compact list of sample holding name and asset/category label; all values visibly illustrative if values are later approved. | Sample holding display name, category, sample marker, optional as-of date. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; field set requires **DAVID + EMMANUEL MUST AGREE**. |
| Recent sample transactions | Small recent-activity list linking to full sample transaction history. | Synthetic transaction display fields in Section 8. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; data contract requires **DAVID + EMMANUEL MUST AGREE**. |
| Statements | Short list or link to sample statements, clearly labelled sample/internal. | Statement-list display fields in Section 9. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; data contract requires **DAVID + EMMANUEL MUST AGREE**. |

---

## 7. Product / Investment View

### Proposed investor-portal display content

| Display element | MVP portal display requirement | Status |
|---|---|---|
| Solution name | Display one of the exact approved names: **Starfetch Fixed Note**, **Starfetch Discretionary Portfolios**, or **Starfetch Execution Mandate**. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Short description | Reuse the current approved public description for the selected solution. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| How it works | Reuse the existing public `How it works` paragraphs, preserving separate paragraphs where currently supplied. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Typical use | Reuse current public Typical Use copy as explanatory content only. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Risk character | Reuse current public risk wording; preserve non-guarantee language where present. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Application entry point | A clear `Start application` / `Select this solution` UI route into the proposed onboarding flow. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Sample-data notice | On any sample portfolio/holding/transaction connection, visibly state that data is illustrative/sample. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |

### BUSINESS DATA REQUIRED BEFORE IMPLEMENTATION

The following must not be invented for the portal. If the eventual UI needs them, approved business data/content is required first:

- Current rates or yields.
- Fees or charges.
- Tenors.
- Minimum investment amount.
- Returns or performance figures.
- Liquidity, redemption, rollover, or withdrawal terms.
- Product availability/eligibility criteria.
- Product-specific terms, disclosures, and effective dates/versions.

---

## 8. Transactions

**Scope:** a clearly marked `Sample / synthetic transaction history` only. The UI does not determine transaction logic, accounting, trade workflow, or live-data treatment.

| Transaction-history column | Frontend display purpose | Status |
|---|---|---|
| Date | Lets the investor locate an illustrative activity item in time. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Description | Human-readable sample activity description. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Direction / Type | A simple display label to distinguish sample activity categories; final vocabulary is not chosen here. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; label vocabulary requires **DAVID + EMMANUEL MUST AGREE**. |
| Amount | Illustrative amount display only, if sample data includes it; never label it as an available payment balance or live return. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; format/semantics require **DAVID + EMMANUEL MUST AGREE**. |
| Status | A display badge for the synthetic item, if supplied. No business transition is implied. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; status vocabulary requires **DAVID + EMMANUEL MUST AGREE**. |
| Sample indicator | Persistent `Sample / illustrative` label above the list or in its heading. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |

Empty state proposal: `No sample transactions are available yet.` This is **PROPOSED — EMMANUEL REVIEW REQUIRED**.

---

## 9. Statements

**Scope:** statement-list UI only. It does not determine statement generation, accounting periods, content, format, storage, or delivery.

| Statement-list item | Frontend-visible information | Status |
|---|---|---|
| Period | Human-readable period label supplied with the sample statement. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Statement name | Accessible display name using `displayName` or equivalent client display key, for example a supplied `Portfolio statement` label. | **BASELINE — SYNCHRONIZED** |
| Sample indicator | `Sample / internal staging data` label. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| View action | Open a permitted statement preview/view location. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; permitted URL/access contract requires **DAVID + EMMANUEL MUST AGREE**. |
| Download action | Download a permitted statement file. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; permitted URL/access contract requires **DAVID + EMMANUEL MUST AGREE**. |

Empty state proposal: `No sample statements are available yet.` This is **PROPOSED — EMMANUEL REVIEW REQUIRED**.

---

## 10. Staff / Admin — Investor List

### Proposed minimal investor list

| Column | Purpose | Required for MVP? | Status |
|---|---|---|---|
| Investor name | Identify the investor record in the review queue. | Yes | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Email address | Distinguish/contact-reference the investor record. | Yes | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Application status | Show the current application review state using approved display labels. | Yes | **PROPOSED — EMMANUEL REVIEW REQUIRED**; status vocabulary requires **DAVID + EMMANUEL MUST AGREE** and may need **BUSINESS / COMPLIANCE INPUT REQUIRED**. |
| Submission date | Let staff identify when an application entered review. This is a confirmed frontend data requirement; David will map it into the API contract. | Yes | **BASELINE — SYNCHRONIZED** |
| View action | Open the investor/application detail review screen. | Yes | **PROPOSED — EMMANUEL REVIEW REQUIRED** |

Deliberately excluded from the first list: financial values, risk score, KYC score, account balance, live portfolio value, staff assignment, and unapproved document/compliance flags.

---

## 11. Staff / Admin — Investor/Application Detail

The page is a review UI. It must display only the fields that the investor was approved to submit and only actions already planned for staff: **Approve**, **Request information**, **Reject**, **Add internal note**, and **View/download document**.

| Group | Proposed display / control | Status |
|---|---|---|
| Investor profile | First name, Last name, Email address, and Mobile phone number when collected/approved. | **BASELINE — SYNCHRONIZED** |
| Application | Selected investment-solution name; submitted date; current application status; read-only application summary. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; final contents/status are subject to **BUSINESS / COMPLIANCE INPUT REQUIRED**. |
| Documents | Document display label, upload/submission date when available, configured review-status location, View/download action. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; required labels/review rules are **BUSINESS / COMPLIANCE INPUT REQUIRED**. |
| Status / history | Current status plus chronological display of approved status/history events and timestamps. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; event fields, labels, and visibility require **DAVID + EMMANUEL MUST AGREE** and may require **BUSINESS / COMPLIANCE INPUT REQUIRED**. |
| Internal notes | Timestamped staff-only note list and `Add internal note` text-area control. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; note visibility, edit/delete policy, and retention require **DAVID + EMMANUEL MUST AGREE**. |
| Actions | `Approve`, `Request information`, `Reject`, `Add internal note`, and `View/download document`. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; reasons, confirmations, status effects, and authorisation require **BUSINESS / COMPLIANCE INPUT REQUIRED**. |

**Do not add:** fund-transfer, payment, settlement, trade, allocation, reconciliation, ledger, document-verification score, or new decision actions.

---

## 12. UI States

These are frontend expectations only. They do not prescribe API mechanisms or backend behaviour.

| Major screen | Loading | Empty | Success | Validation error | Server error | Unauthorized / forbidden | Disabled control | Status |
|---|---|---|---|---|---|---|---|---|
| Registration | CTA `Creating account…`; prevent duplicate submit. | N/A | Confirmation directing user to sign in. | Inline beneath field; form focus remains understandable. | Form-level, non-sensitive message with Retry when appropriate. | Route user to sign-in state if account setup requires it; no technical detail. | CTA disabled for clearly invalid/in-progress form. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Login | CTA `Signing in…`; prevent duplicate submit. | N/A | Continue to the approved portal landing destination. | Inline required/email-format messages. | Form-level non-sensitive failure message. | Show the same safe sign-in failure or approved access message. | CTA disabled when invalid/in progress. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; outcome mapping requires **DAVID + EMMANUEL MUST AGREE**. |
| Profile | Section/skeleton placeholders. | `No profile details are available yet` only where applicable. | Saved confirmation near edited section. | Inline next to editable fields. | Section-level Retry; preserve unsaved inputs where safe. | Explain that the profile is unavailable to this account/role and provide safe navigation. | Save disabled if unchanged, invalid, or saving. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Onboarding / application | Step skeleton and clear current-step progress. | No default empty state; display missing-required-section prompt. | Step-saved / application-submitted acknowledgement. | Inline by field/card plus step summary if needed. | Step-level Retry; do not lose entered UI data where safe. | Explain that the application cannot be accessed/continued by this role. | Continue/Submit disabled until approved required UI items are complete or submitting. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Document upload | Per-card queued/uploading state/progress. | `No documents requested yet` when configuration supplies none. | Uploaded/replaced confirmation on relevant card. | Inline file-selection/file-policy message. | Inline card error with Retry/Replace if allowed. | Hide/disable unavailable file actions with an accessible explanation. | Upload/Replace disabled while in progress or status prevents change. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Dashboard / product view | Card/list skeletons; static product content may render independently. | `No sample data available yet` for absent sample blocks. | Render clearly labelled sample data. | N/A except application-entry controls. | Per-card error with Retry; do not blank unrelated dashboard blocks. | Safe access-denied message and navigation. | Application entry disabled only when application state prevents a new action, with approved explanation. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Transactions / statements | Table/list skeletons. | `No sample transactions/statements are available yet.` | Render list with persistent sample indicator. | N/A. | Inline list error and Retry. | Safe access-denied message; no file details exposed. | View/download disabled when unavailable, with accessible explanation. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Staff investor list | Table rows/skeletons. | `No investors match this view.` | Display minimal investor list. | Filter/search validation only if those controls are later approved. | Table-level error and Retry. | Access-denied screen; do not expose investor data. | View unavailable when record access is denied. | **PROPOSED — EMMANUEL REVIEW REQUIRED** |
| Staff detail / review | Detail section skeletons; actions show in-progress state. | No-data sections state what is unavailable without inventing a reason. | Action acknowledgement and refreshed status/history only after approved result. | Inline note/action-reason errors where a required approved field exists. | Action-level failure; preserve unsubmitted note/reason when safe. | Return to authorised list/access-denied state without record leakage. | Action disabled while in progress or when the approved state/permission prevents it. | **PROPOSED — EMMANUEL REVIEW REQUIRED**; action-result/status rules require **DAVID + EMMANUEL MUST AGREE** and **BUSINESS / COMPLIANCE INPUT REQUIRED**. |

---

## 13. D-06 v1 Baseline Inventory

### A. EMMANUEL CAN APPROVE NOW

This list distinguishes the synchronized baseline UI items from items that still need backend or business/compliance agreement.

1. The baseline registration form: First name, Last name, Email address, Password, Confirm password; inline validation; show/hide passwords; `Create account`; `/login` link.
2. The minimal login form: Email address, Password, show/hide password, `Sign In`, Create-account link, Forgot-password link placeholder, safe invalid-credentials message, loading/disabled states.
3. The light portal UI patterns already aligned with the public Starfetch system: accessible labels, inline field errors, visible loading states, non-sensitive form errors, empty states, disabled-control explanation, responsive layouts.
4. The baseline basic profile layout: First name, Last name, Email address display, Mobile phone number where collected/approved, and an optional non-regulatory completion prompt.
5. The six-step proposed information architecture: Basic information → Application details → Documents → Consent/declarations → Review → Submit.
6. Product discovery and display that reuses approved public content and preserves the three exact solution names.
7. Sample/synthetic labels on all MVP portfolio, holdings, transactions, and statements views.
8. Minimal transaction list: Date, Description, Direction/Type, Amount when supplied, Status when supplied, plus sample indicator.
9. Baseline statement list: Period, Statement name (`displayName` or equivalent), sample indicator, View, Download.
10. Baseline staff list: Investor name, Email address, Application status, Submission date, View. Submission date is a confirmed frontend data requirement.
11. Staff-detail grouping and only the already planned staff action controls.

### B. DAVID + EMMANUEL MUST AGREE

1. Registration success response and post-registration UI destination; login success destination; safe mapping of authentication failures to frontend messages.
2. Which profile fields are returned/editable, whether Email change is permitted, and the completion/missing-section data contract.
3. Application status display vocabulary, current-status response, timestamps, history-event response, and frontend refresh behaviour.
4. Exact response data for the selected solution, sample portfolio, holdings, synthetic transactions, and sample statements; how all sample data is labelled.
5. Form error structure and server-error mapping for registration, login, profile save, application submit, note entry, and staff actions.
6. Upload response metadata, safe Retry/Replace behaviour, view/download link response, and role-safe document access outcomes.
7. Staff list/detail response fields; pagination/search/filter needs only if Emmanuel chooses them later; note display/submission contract.
8. Role/permission outcomes and the safe UI response to unauthorized/forbidden results.
9. The approved API-driving data required to render loading, success, empty, and error states—without selecting authentication/session architecture.

### C. BUSINESS / COMPLIANCE INPUT REQUIRED

Do not decide these independently. No values, rules, declarations, documents, or workflows are supplied by this report.

1. All KYC, identity, BVN/NIN, AML/PEP, identity-verification, nationality, residency, date-of-birth, address, tax, organisation, representative, and beneficial-owner requirements.
2. The exact document inventory; required/optional document policy; accepted formats/size/expiry rules; review labels; replacement rules; retention/deletion; and investor/staff access policy.
3. Consent/declaration/attestation text, legal-policy links, requiredness, versioning, timestamp/withdrawal treatment, and any regulatory acknowledgement.
4. Suitability/risk-assessment questions, scoring, risk labels, investment goals, horizon, investment mandate/instruction, allocation, limits, or investment amount.
5. Product terms and all currently absent commercial data: current rates/yields, fees, tenors, minimum investment, returns, liquidity/redemption/rollover terms, eligibility, disclosures, and version dates.
6. Application status vocabulary and transition policy; reasons/confirmation requirements for Approve, Request information, Reject, document review, and the visibility of associated history.
7. Internal-note governance, audit/event visibility and retention, staff/admin authority boundaries, and any reviewer escalation/assignment policy.
8. Password-recovery and account-security business rules, including any communication/verification process.
9. Any external integration, live funds/trading, payment, banking, custody/brokerage, market data, notification, or proprietary IMS requirement.

**Stopping point:** this is the D-06 v1 baseline frontend requirements record. It remains living under the D-06 Change Control process. No portal, API, database model, authentication implementation, mobile implementation, or compliance workflow has been created or authorised by this document.
