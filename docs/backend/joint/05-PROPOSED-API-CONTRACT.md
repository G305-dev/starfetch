# 05 — Proposed API Contract (REVISED — validated draft, still UNAPPROVED)

Companion: **PROPOSED-JOINT-API-DRAFT.yaml** v`0.5.0-draft.3` — now passes
**semantic OpenAPI validation** (Redocly lint: 0 errors / 0 warnings): every
path parameter declared; `securitySchemes` (`bearerAuth` JWT + `csrfHeader`
`X-CSRF-Token`) defined and **AND-combined** (`security: - bearerAuth: []
csrfHeader: []` — a single requirement object; OpenAPI would otherwise read two
array items as OR). No mutating operation is documented as accepting CSRF alone;
each mutation states the full server-side chain — origin allowlist, session
validity/revocation check, CSRF double-submit, INVESTOR role, membership. Full
request bodies,
response + error schemas, pagination constraints (`page ≥ 1`,
`1 ≤ pageSize ≤ 100`, default 20), and operationIds on all nine operations.
Remains a **separate fragment**; `docs/api/openapi.yaml` unchanged.

## The nine proposed operations

| # | Method & path | AuthN | AuthZ | Mutating protections | Purpose |
|---|---|---|---|---|---|
| R1 | `GET /me/joint-accounts` | bearer session | INVESTOR | — | List accounts where caller is ACTIVE member; `[]` normal |
| R2 | `GET /joint-accounts/{id}` | bearer session | INVESTOR + membership | — | Account detail + members |
| R3 | `GET /joint-accounts/{id}/portfolio` | bearer session | INVESTOR + membership | — | Phase-2D PortfolioResponse shape — `totalReturnMinor` always `null`; honest empty state |
| R4 | `GET /joint-accounts/{id}/transactions` | bearer session | INVESTOR + membership | — | Phase-2D transactions envelope + pagination |
| M1 | `POST /joint-accounts` | bearer session + CSRF (AND) | INVESTOR + verified email | Origin + session + CSRF + user-keyed limit | Initiate account + PENDING invite (single ACTIVE member — "awaiting second holder") |
| M2 | `POST /joint-accounts/{id}/invitations` | bearer session + CSRF (AND) | INVESTOR + membership | Origin + session + CSRF + user+account rate key | Re/invite; generic anti-enumeration 201 |
| M3 | `GET /me/joint-invitations` | bearer session | INVESTOR | — | Pending inbox addressed to caller's verified email |
| M4 | `POST /me/joint-invitations/{id}/accept` | bearer session + CSRF (AND) | INVESTOR + verified email (DB lookup) + address match | Origin + session + CSRF + capacity-locked tx (03 §3) | Consent → ACTIVE; **authorized replay = same 200 w/o side effects**; revoked/declined 404; expired `410` (addressee only); `409` when full; unverified email `403 EMAIL_NOT_VERIFIED` (existing vocabulary) |
| M5 | `POST /me/joint-invitations/{id}/decline` | bearer session + CSRF (AND) | INVESTOR + address match (DB lookup) | Origin + session + CSRF + account-then-invitation locks | Terminal DECLINED — idempotent repeat-safe |

## Error taxonomy (per draft YAML)

`400 VALIDATION_FAILED` (malformed/unknown/out-of-range inputs, self-invite) ·
`401 UNAUTHENTICATED` · `403 FORBIDDEN` (non-INVESTOR; `EMAIL_NOT_VERIFIED` code for unverified callers
on accept — reuses the approved vocabulary) · `404 NOT_FOUND` (**identical for unknown-account vs non-member,
unknown vs not-addressed-to-me — anti-enumeration**) · `409 CONFLICT` (account
full / concurrent capacity loss) · `410 GONE` (expired invitation, addressee
only) · `429 RATE_LIMITED` (with `retryAfterSeconds`) · `500 INTERNAL_ERROR`
(requestId only). All use the existing ErrorEnvelope.

## Property guarantees asserted by the contract

- No account ID/userId accepted from body/query; path ID + bearer identity + DB
  membership only.
- Joint reads physically scoped by `portfolio.jointAccountId` after guard;
  Individual `/me/*` never returns joint rows (XOR ownership, doc 02 §2.2).
- Empty states (`data: []`, `total: 0`, `totalValueMinor: 0`, `holdings: []`)
  are first-class, honest, successful responses — no fabricated records.
- `awaitingSecondHolder` flag present in list/detail payloads so Emmanuel can
  render the one-member state truthfully.
