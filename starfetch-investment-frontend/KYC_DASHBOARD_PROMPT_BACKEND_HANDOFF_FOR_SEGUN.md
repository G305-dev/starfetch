# KYC Completion Prompt — Backend Handoff for Segun

**Date:** 22 October 2026  
**Audience:** Segun / Backend Team  
**Status:** Draft for API-contract agreement  
**Scope:** Individual Investor and Corporate Applicant dashboard entry

---

## 1. Objective

After a user successfully signs in and reaches an authenticated investment dashboard, the frontend must show a **“Complete your KYC”** popup **unless the backend confirms that the relevant KYC process is complete**.

This applies to:

1. **Individual Investor** dashboard: `/dashboard`
2. **Corporate Applicant** dashboard: `/corporate/dashboard`

The popup is a reminder and routing control only. It must not itself submit KYC data, create an investment, approve an account, or grant Corporate access.

---

## 2. Required user flow

### A. Individual Investor

1. User selects **Individual** at sign-in.
2. User signs in using the existing Investor email and password flow.
3. The existing authentication flow completes and routes the user to `/dashboard`.
4. The frontend reads the backend’s authoritative **Individual KYC completion status**.
5. If that status is anything other than confirmed complete, show the modal:
   - Heading: **Complete your KYC**
   - Primary link/button: **Complete KYC**
   - Destination: `/profile`
6. The popup has no dismiss, close, “Not now”, or persistent suppression control.
7. If the backend status is confirmed complete, do not show the popup.

### B. Corporate Applicant

1. User selects **Business / Corporate** at sign-in.
2. User signs in with the verified Corporate applicant email address and password.
3. The existing shared Investor authentication flow completes and routes the user to `/corporate/dashboard`.
4. The frontend reads the backend’s authoritative **Corporate-applicant KYC completion status**.
5. If that status is anything other than confirmed complete, show the modal:
   - Heading: **Complete your KYC**
   - Primary link/button: **Complete KYC**
   - Destination: `/corporate/profile`
6. The popup has no dismiss, close, “Not now”, or persistent suppression control.
7. If the backend status is confirmed complete, do not show the popup.

> For Corporate applicants, the status may represent the applicable applicant KYC and/or Corporate KYC/KYB completion gate. The backend remains the sole authority for determining this; the frontend must receive only a safe completion result.

---

## 3. Existing frontend integration points

| Journey | Existing route | Existing popup destination | Existing authentication boundary |
|---|---|---|---|
| Individual | `/dashboard` | `/profile` | Authenticated Investor session |
| Corporate applicant | `/corporate/dashboard` | `/corporate/profile` | Authenticated Investor session |

The popup component already has these frontend characteristics:

- It is an accessible modal (`role="dialog"`, `aria-modal="true"`).
- It has one user action only: the **Complete KYC** link.
- It stores no dismissal value in browser storage.
- It does not claim that local data, a form draft, or a navigation action completes KYC.
- It currently renders on fresh dashboard entry because an approved backend completion signal is not yet available.

Once the backend contract below is available, the frontend will change the display condition to show the popup only when the backend does **not** return `COMPLETE`.

---

## 4. Backend requirement: authoritative KYC completion signal

### Recommended contract

Extend the existing authenticated `GET /api/v1/me` response with a small, safe completion projection for both portal contexts:

```json
{
  "data": {
    "id": "user-id",
    "firstName": "Ada",
    "lastName": "Okafor",
    "email": "ada@example.com",
    "role": "INVESTOR",
    "kycCompletion": {
      "individual": "REQUIRED",
      "corporate": "COMPLETE"
    }
  }
}
```

### Permitted values

The frontend only needs a final server-calculated state. A two-value contract is preferred:

- `COMPLETE` — KYC is approved and complete for that portal context.
- `REQUIRED` — KYC is not confirmed complete; show the popup.

If backend workflow requires more detailed states, it may return them internally (for example `NOT_STARTED`, `IN_PROGRESS`, `PENDING_REVIEW`, `REJECTED`, or `NOT_APPLICABLE`), but the frontend display rule must remain fail-closed:

| Backend result | Frontend popup behaviour |
|---|---|
| `COMPLETE` | Do not show popup |
| Any non-complete state | Show popup |
| Missing, malformed, unavailable, or unknown status | Show popup |

### Why `GET /me` is recommended

- The frontend already retrieves the authenticated user from `GET /api/v1/me` after login and session refresh.
- It keeps completion status tied to the authenticated backend session rather than to client-managed storage.
- It provides a fresh value after every new login/session restoration.
- It avoids adding a second client-side source of truth.

If a separate endpoint is preferred, it must be authenticated, return the same safe per-context completion result, and be called before the dashboard decides whether to display the popup. The status must never be inferred from frontend form fields, route choice, or local storage.

---

## 5. Authentication and Corporate safety constraints

1. **Use the existing shared Investor authentication endpoint.** Individual, Joint, and Corporate applicants currently sign in through the established `POST /api/v1/auth/login` email-and-password flow.
2. **Do not require or accept an RC Number at login.** RC Number is not a login credential.
3. **Corporate sign-in does not prove a Corporate authorization role or approved Corporate investment account.** The popup/status contract must not expose company records or change existing owner-scoped discovery/verification protections.
4. The backend—not the selected login tab—must calculate and return the completion state.
5. Return only the minimum status required for the popup. Do not return KYC answers, identity-document values, screening outcomes, BVN/NIN values, or other sensitive verification data in this response.
6. A status of `COMPLETE` must be based on an approved backend process, not a frontend form interaction or a user’s acknowledgement of the popup.

---

## 6. Frontend display policy to preserve

The backend response will drive this exact policy:

- Evaluate the applicable context on every fresh authenticated dashboard entry/login.
- Show the popup until the backend returns `COMPLETE` for that context.
- Do not use `localStorage`, `sessionStorage`, cookies controlled by the frontend, or a one-time dismissal flag to hide it.
- Do not add a dismiss/close/“Not now” action.
- Keep the only action as the approved profile destination:
  - Individual → `/profile`
  - Corporate applicant → `/corporate/profile`

---

## 7. Acceptance test scenarios for Segun and QA

| ID | Scenario | Expected result |
|---|---|---|
| KYC-01 | Individual signs in; backend returns `individual: REQUIRED` | User reaches `/dashboard`; Complete your KYC popup appears; action goes to `/profile`. |
| KYC-02 | Individual signs in; backend returns `individual: COMPLETE` | User reaches `/dashboard`; popup does not appear. |
| KYC-03 | Corporate applicant signs in with valid applicant email/password; backend returns `corporate: REQUIRED` | User reaches `/corporate/dashboard`; popup appears; action goes to `/corporate/profile`. |
| KYC-04 | Corporate applicant signs in; backend returns `corporate: COMPLETE` | User reaches `/corporate/dashboard`; popup does not appear. |
| KYC-05 | KYC value is absent, invalid, or an unrecognised workflow state | Fail closed: popup appears; no access/approval claim is made. |
| KYC-06 | User refreshes or starts a new authenticated session while status remains non-complete | Popup appears again on dashboard entry. |
| KYC-07 | User navigates to the profile then returns to dashboard without backend completion | Popup continues to appear on fresh dashboard entry. |
| KYC-08 | Backend later approves KYC | A new login/session/dashboard entry receives `COMPLETE`; popup no longer appears. |
| KYC-09 | Corporate status is requested | No RC Number is sent as a credential; no Corporate company record is exposed merely because the user selected the Corporate tab. |
| KYC-10 | Popup shown | No KYC form values, documents, investment instructions, funding requests, or enquiries are submitted by the popup. |

---

## 8. Requested backend deliverable

Please provide:

1. The approved response schema for the authenticated KYC completion status.
2. The canonical endpoint that will supply it (`GET /api/v1/me` is recommended).
3. Exact allowed values and the rule for when `COMPLETE` is returned.
4. Confirmation that the state is calculated from approved backend KYC/KYB workflow data.
5. Test accounts or safe test fixtures covering both `REQUIRED` and `COMPLETE` for Individual and Corporate Applicant dashboard contexts.
6. Any authentication, refresh-token, or authorization considerations needed for the frontend integration.

---

## 9. Out of scope for this request

- Submitting KYC data from the popup.
- Persisting individual local draft KYC fields.
- Completing/screening/verifying KYC in the browser.
- Investment execution, product booking, funding, or account approval.
- Changing the existing Corporate applicant authentication model.
- Granting Corporate account access based only on a login tab choice or KYC popup state.
