# Mono Prove sandbox adapter — implementation and activation status

**As of:** 2026-10-22
**Disposition:** User selected preparation for sandbox-only Mono integration. The backend adapter seam and synthetic tests are implemented, but the provider remains unavailable. No request was sent to Mono, no credentials were configured or inspected, no public route/webhook URL was created, and no evidence/replay persistence model is active.

## Provider contract used

- Mono Prove initiation is `POST https://api.withmono.com/v1/prove/initiate` authenticated by the backend-only `mono-sec-key` header. Mono documents sandbox and production using the same API host with different keys; this implementation explicitly allows only `MONO_PROVE_ENVIRONMENT=sandbox`.
- The `custom` KYC flow requires `identities` and at least one `bvn` or `nin`; the adapter accepts only the configured rule-derived identity list and requires an approved consent authorizer to confirm the request is covered.
- Mono documents webhook authentication via the `mono-webhook-secret` header. The implementation compares that secret in constant time; it does **not** assume an undocumented HMAC signature. Prove events include initiated, successful, awaiting review, cancelled, expired, rejected, and failed. The parser accepts the documented outer and nested-failure envelopes, strips customer data, and normalizes only provider status.
- Mono's public docs/examples do not establish a durable idempotency contract for the initiate POST or a stable `event_id` on every Prove event. Therefore POST auto-retries are deliberately disabled (single bounded 8-second attempt); retries remain blocked until provider idempotency semantics are confirmed. Webhook replay digest uses event ID when present, otherwise event name + provider session ID + provider timestamp, and still requires an atomic durable replay store.
- Successful initiation is `PENDING`, successful provider webhook is `PROVIDER_VERIFIED`, and provider rejection/failure is `PROVIDER_FAILED`. These are evidence states only and never the six-state onboarding status or final compliance approval.

## Implemented safety controls

- `MonoProveAdapter` refuses by default unless `MONO_PROVE_ENABLED=true`, environment is sandbox, vendor secret and approved redirect configuration exist, lawful-basis/privacy/consent gates are true, and the request has an approved consent record with matching subject/application/text version/identity scope.
- Before network I/O, it reserves an evidence operation; the adapter returns a provider URL only after a durable evidence append succeeds. Provider responses are schema-checked, provider URLs must be HTTPS on a `withmono.com` host, and raw payloads are reduced to a SHA-256 digest. Request bodies, IDs, names, phone/email, credentials, and raw provider payloads are never logged or returned.
- Transport timeout is bounded at eight seconds. Provider transport/429/5xx/invalid-response results map to `UNAVAILABLE`, not a customer identity failure. Provider 4xx request rejection is `PROVIDER_FAILED`, not a final compliance decision.
- `MonoProveWebhookProcessor` requires the documented shared-secret header, validates and normalizes supported events, and delegates deduplication plus sanitized evidence append to one injected atomic append-once journal operation (the default journal is disabled).
- `SyntheticVerificationAdapter` is restricted to `NODE_ENV=test` and produces deterministic synthetic evidence metadata without network access.

## Still blocking all actual calls

The application module wires deny-all defaults for consent authorization, provider evidence journaling, and webhook replay storage. No database tables or public initiation/webhook routes were added for this adapter. Thus even setting a vendor key cannot cause an external call in the current build: a persisted approved-consent implementation and append-only evidence/replay schema are required first. These will need their own migration, security review, E2E tests, and D-06 route approval before exposure.

Mono sandbox activation also requires all of the following through approved operational channels (never in source control or chat): approved lawful-basis/privacy text and exact consent text/version; `MONO_PROVE_LAWFUL_BASIS_APPROVED=true`, `MONO_PROVE_PRIVACY_NOTICE_APPROVED=true`, `MONO_PROVE_CONSENT_TEXT_APPROVED=true`; sandbox `MONO_SEC_KEY` and distinct `MONO_WEBHOOK_SECRET`; `MONO_PROVE_REDIRECT_URL` whose origin is in `CORS_ORIGINS`; and a persistence provider for consent/evidence/replay. Production/live keys and live mode are not enabled by this change.

## Official Mono references

- https://docs.mono.co/api/prove/initiate
- https://docs.mono.co/docs/environments
- https://docs.mono.co/docs/webhooks
- https://docs.mono.co/docs/lookup/prove/webhook-events
