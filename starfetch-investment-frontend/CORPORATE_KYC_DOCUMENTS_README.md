# Batch 10 — Corporate KYC Section 5: Corporate Document Upload

Frontend-only change on branch `corporate-work`. Nothing was committed, pushed, merged or deployed.

The Corporate Profile journey now has **five** sections. Sections 1–4 are unchanged and remain
page-memory only; the new **Section 5 — Corporate Document Upload** is backend-backed and is the
only part of the profile that talks to David's Corporate KYC document API.

---

## 1. Files changed

| File | Change |
| --- | --- |
| `components/corporate/CorporateDocumentUploadSection.tsx` | **ADDED** — Section 5 UI: three mandatory documents, per-document upload/replace, saved records, blockers and submission. |
| `components/corporate/CorporateProfileContent.tsx` | **MODIFIED** — added the Section 5 tile + step. The four local-only sections, their fields, sequential validation and copy are untouched. |
| `lib/api/client.ts` | **MODIFIED, additive only** — multipart support in the shared request helper, three new error codes, KYC document/submission types + normalisers + four endpoint functions. Existing behaviour unchanged. |
| `scripts/corporate-kyc-documents-check.ts` | **ADDED** — regression check for the items below. |
| `package.json` | **MODIFIED** — adds `test:corporate-kyc-documents`. |
| `CHANGED_FILES.txt`, this README | **DOCS** |

Not touched: Individual portal/onboarding, Joint portal/onboarding, Admin portal, `AuthProvider`,
login/session management, Corporate dashboard/sidebar/navbar/branding, backend, Prisma, env files.
`app/corporate/profile/page.tsx` is unchanged — it keeps rendering `CorporateProfileContent`.

### The only two lines replaced in `lib/api/client.ts`

`request()` gained a `rawBody` option so multipart uploads can be sent without manually setting
`Content-Type` (the browser must own the boundary). JSON behaviour is byte-identical:

```ts
// before
headers: { ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...options.headers },
body: options.body === undefined ? undefined : JSON.stringify(options.body),

// after
headers: { ...(options.rawBody === undefined && options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...options.headers },
body: options.rawBody !== undefined ? options.rawBody : options.body === undefined ? undefined : JSON.stringify(options.body),
```

---

## 2. Backend contract used (David's handoff + `docs/api/openapi.yaml`, tag "Corporate KYC Documents")

No endpoint is invented and nothing is uploaded directly to storage.

| Operation | Endpoint |
| --- | --- |
| Read requirements, saved documents, section status, `canSubmit` | `GET /api/v1/corporate-accounts/{corporateAccountId}/kyc-documents` |
| Upload / replace one document | `POST /api/v1/corporate-accounts/{corporateAccountId}/kyc-documents/{category}` (multipart: `file`, plus `replacesDocumentId` only when replacing) |
| Open a saved document | `POST /api/v1/corporate-accounts/{corporateAccountId}/kyc-documents/{documentId}/view-authorization` → signed, ≤60 s, version-pinned URL opened immediately |
| Submit for review | `POST /api/v1/corporate-accounts/{corporateAccountId}/submission` with `Idempotency-Key` |

Client functions added in `lib/api/client.ts`:

```ts
getCorporateKycDocuments(corporateAccountId)
uploadCorporateKycDocument(corporateAccountId, category, file, replacesDocumentId?)
authorizeCorporateKycDocumentView(corporateAccountId, documentId)
submitCorporateApplication(corporateAccountId, idempotencyKey)
```

They route through the existing `authenticatedRequest` / `authenticatedMutation` helpers, so the
in-memory bearer token, the bounded refresh-and-retry, `X-CSRF-Token` from the double-submit cookie
(re-read on every attempt) and `credentials: "include"` all behave exactly as the rest of the app.

The corporate account ID is resolved exactly like the rest of the Corporate portal — via
`getMyCorporateApplications()` (`GET /me/corporate-accounts`) — never from storage or a URL.

The OpenAPI response envelope is `{ data, meta: { requestId } }`; every normaliser reads `data`
through the existing `unwrapPayload` helper and rejects any shape it does not fully understand
(`UNEXPECTED_RESPONSE`) instead of guessing.

---

## 3. What the section does

* Titles, descriptions, accepted types/extensions and `maxSizeBytes` are rendered **from the GET
  response**, not hard-coded.
* Exactly three requirements: `CERTIFICATE_OF_INCORPORATION`, `MEMART`, `TIN_CERTIFICATE`, all
  mandatory. The runtime category list and the `CorporateKycDocumentCategory` union are limited to
  those three; any other category is rejected client-side before a request is made.
* Separate file control per document; the selected filename and size are shown.
* Client-side extension + size pre-check using the backend's own limits; server errors still win.
* During upload the button shows a disabled "Uploading…" state with an animated indicator and the
  filename. Bytes are streamed by the browser via `FormData`; because `fetch` does not expose
  upload-byte progress in this stack, a determinate percentage is never fabricated.
* Success and failure are reported only from the actual response: on 201 the returned
  `CorporateKycDocumentsData` is applied, so the status badge, section counter and saved-file block
  all come from the backend.
* Saved records show `displayFilename`, version, size, upload time and `reviewStatus`. If the
  applicant leaves and returns, `GET` repopulates everything — nothing is cached in the browser.
* Missing documents are called out explicitly ("Missing", "This mandatory document has not been
  uploaded yet.").
* Replacement is offered **only** when `canReplace` is true, first upload only when `canUpload`,
  and both disappear when `blockedReason === "APPLICATION_NOT_EDITABLE"`.
* `scanStatus` is `NOT_SCANNED` and the UI never claims "clean", "virus-free" or "verified".
* No `localStorage` / `sessionStorage` anywhere in the section or the client changes.

## 4. Submission

* Submit is rendered disabled unless `submission.canSubmit === true` (backend flag only — the
  Profile API's `progress.canSubmit` is not used).
* `blockers` are listed in plain language (missing profile section, missing document category,
  application state).
* One UUID `Idempotency-Key` is generated per Submit intent and reused for retries; it is cleared
  only after a successful response.
* On 201 the receipt is shown: "Submitted for Starfetch review" plus the backend `submissionId` as
  the reference and `submittedAt`. `idempotentReplay` is not surfaced as a new submission.
* If the application is already submitted (`submission.submissionId` set, or status is past
  `DRAFT`/`INFO_REQUESTED`), the confirmation block is shown instead of the button.
* A 409 `SUBMISSION_INCOMPLETE` / `ALREADY_SUBMITTED` triggers a re-read of the GET endpoint so the
  real blockers or real status are displayed. No fake status is ever written.

## 5. Error handling

| Condition | UI |
| --- | --- |
| `FEATURE_UNAVAILABLE` (503, private storage flags off) | "Document upload is temporarily unavailable. Nothing has been stored. Please try again later." with a Try again button; the section never pretends to work |
| `FILE_TOO_LARGE` (413) | asked to choose a smaller file |
| `UNSUPPORTED_FILE_TYPE` (415) | ask for a plain PDF/JPEG/PNG scan |
| `CONFLICT` (409) | re-reads the GET endpoint, shows the current truth |
| `RATE_LIMITED` (429) | wait and retry message |
| `UNAUTHENTICATED` / `CSRF_VALIDATION_FAILED` | session messages; no data loss messaging |
| `NETWORK_ERROR` | connection message, safe retry |

New codes `CSRF_VALIDATION_FAILED`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE` were added to
`ApiErrorCode`/`safeMessages`; 413 → `FILE_TOO_LARGE`, 415 → `UNSUPPORTED_FILE_TYPE`,
503 → `FEATURE_UNAVAILABLE`. The only exhaustive-ish consumer (Individual KYC) has a `default`
branch, verified before the change.

---

## 6. Five-section flow

1. Company Details — unchanged, local-only
2. Investment Profile — unchanged, local-only
3. Source of Funds — unchanged, local-only
4. Bank Details — unchanged, local-only
5. Corporate Document Upload — new, backend-backed

Section 5 unlocks after the four local sections are marked complete in this page session (the tile
and the "Continue to Section 5" button stay disabled until then). Its own completion status comes
from `section.status` (`NOT_STARTED` / `DRAFT` / `COMPLETE`) returned by the backend, not from local
state. The section 1–4 note still says their values are not saved and are cleared on refresh —
that text was adjusted only to say the same thing about sections 1–4 specifically.

---

## 7. Validation run

```
npm run typecheck                     ✓
npm run test:corporate-kyc-documents  PASS  (new)
npm run test:corporate-profile        PASS  (local-only + sequential checks still pass)
full suite: 35/35 check scripts PASS
npm run build                         ✓  /corporate/profile 13.3 kB
```

The build/routes for Individual and Joint products, dashboards and profiles report unchanged sizes.

## 8. Known dependency (backend, not frontend)

Upload and view return `503 FEATURE_UNAVAILABLE` until the private-S3 approval flags and IAM items
in David's completion report are confirmed. The UI handles that as a first-class state. `GET
/kyc-documents` and the submission call do not depend on S3.

## 9. Not done, by instruction

No commits, no pushes, no merges, no deployments, no backend/Prisma/env changes, no changes to
Individual/Joint/Admin portals, auth or session code, or the Corporate dashboard/sidebar/navbar.
