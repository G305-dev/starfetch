import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MONO_EVIDENCE_JOURNAL,
  MONO_HTTP_TRANSPORT,
  MONO_PROVE_CONSENT_AUTHORIZER,
  MonoEvidenceJournal,
  MonoEvidenceReservation,
  MonoEvidenceStatus,
  MonoHttpTransport,
  MonoProveConsentAuthorizer,
  MonoProveAuthorizationRequest,
} from './mono-verification-ports';

const MONO_PROVE_INITIATE_URL = 'https://api.withmono.com/v1/prove/initiate';
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 1; // POST retry is deliberately withheld until Mono documents reference idempotency.
const ALLOWED_PROVIDER_HOST = /(^|\.)withmono\.com$/i;

export interface MonoProveInitiationInput extends MonoProveAuthorizationRequest {
  readonly operationKey: string;
  readonly customer: {
    readonly name: string;
    readonly phone: string;
    readonly email: string;
    readonly address?: string;
    readonly identity: { readonly number: string; readonly type: 'bvn' | 'nin' };
  };
}

export type MonoProveInitiationResult =
  | {
      readonly status: 'PENDING';
      readonly evidenceId: string;
      readonly reference: string;
      readonly providerSessionId: string;
      readonly redirectUrl: string;
      readonly rawPayloadSha256: string;
      readonly idempotentReplay: boolean;
    }
  | {
      readonly status: Exclude<MonoEvidenceStatus, 'PENDING'>;
      readonly evidenceId: string | null;
      readonly reference: string | null;
      readonly safeReason: string;
      readonly idempotentReplay: boolean;
    };

/**
 * Sandbox-only Mono Prove initiation adapter. It never grants approval: a
 * successful initiation is PENDING until an authenticated provider event is
 * durably appended and a separate compliance workflow evaluates it.
 *
 * No public route uses this adapter. It is additionally fail-closed behind
 * config, an approved persisted-consent authorizer, and an append-only evidence
 * journal. Live mode is intentionally rejected in this change.
 */
@Injectable()
export class MonoProveAdapter {
  constructor(
    private readonly config: ConfigService,
    @Inject(MONO_HTTP_TRANSPORT) private readonly transport: MonoHttpTransport,
    @Inject(MONO_PROVE_CONSENT_AUTHORIZER) private readonly consent: MonoProveConsentAuthorizer,
    @Inject(MONO_EVIDENCE_JOURNAL) private readonly evidence: MonoEvidenceJournal,
  ) {}

  async initiate(input: MonoProveInitiationInput): Promise<MonoProveInitiationResult> {
    const settings = this.config.get<MonoSettings>('corporate.mono');
    if (!settings?.enabled || settings.environment !== 'sandbox') {
      return unavailable(null, null, 'FEATURE_DISABLED');
    }
    if (!settings.secretKey || !settings.redirectUrl || !isSafeRedirectUrl(settings.redirectUrl) || !settings.consentTextVersion ||
      !settings.consentTextSha256 || !/^[0-9a-f]{64}$/.test(settings.consentTextSha256) ||
      !settings.privacyNoticeVersion || !settings.lawfulBasisVersion ||
      !settings.lawfulBasisApproved || !settings.privacyNoticeApproved || !settings.consentTextApproved) {
      return unavailable(null, null, 'PROVIDER_CONFIGURATION_INCOMPLETE');
    }
    const requestError = validateInput(input);
    if (requestError) return unavailable(null, null, requestError);

    let approvedConsent;
    try {
      approvedConsent = await this.consent.requireApprovedConsent(input);
    } catch {
      return unavailable(null, null, 'APPROVED_CONSENT_REQUIRED');
    }
    if (
      approvedConsent.applicationId !== input.applicationId ||
      approvedConsent.subjectUserId !== input.subjectUserId ||
      approvedConsent.consentRecordId !== input.consentRecordId ||
      approvedConsent.textVersion !== settings.consentTextVersion ||
      approvedConsent.privacyNoticeVersion !== settings.privacyNoticeVersion ||
      approvedConsent.lawfulBasisVersion !== settings.lawfulBasisVersion ||
      input.identities.some((identity) => !approvedConsent.allowedIdentities.includes(identity))
    ) {
      return unavailable(null, null, 'APPROVED_CONSENT_REQUIRED');
    }

    let reservation: MonoEvidenceReservation;
    try {
      reservation = await this.evidence.reserve({
        applicationId: input.applicationId,
        requirementId: input.requirementId,
        actorUserId: input.actorUserId,
        subjectUserId: input.subjectUserId,
        consentRecordId: input.consentRecordId,
        consentTextVersion: approvedConsent.textVersion,
        identities: input.identities,
        operationKey: input.operationKey,
      });
    } catch {
      return unavailable(null, null, 'EVIDENCE_JOURNAL_UNAVAILABLE');
    }

    if (!validReservation(reservation)) return unavailable(null, null, 'INVALID_EVIDENCE_RESERVATION');
    if (!reservation.shouldInitiate) {
      if (reservation.existingStatus === 'PENDING' && reservation.providerSessionId &&
        reservation.redirectUrl && isSafeMonoUrl(reservation.redirectUrl)) {
        return {
          status: 'PENDING',
          evidenceId: reservation.evidenceId,
          reference: reservation.reference,
          providerSessionId: reservation.providerSessionId,
          redirectUrl: reservation.redirectUrl,
          rawPayloadSha256: '',
          idempotentReplay: true,
        };
      }
      return {
        status: reservation.existingStatus && reservation.existingStatus !== 'PENDING'
          ? reservation.existingStatus
          : 'UNAVAILABLE',
        evidenceId: reservation.evidenceId,
        reference: reservation.reference,
        safeReason: reservation.existingStatus ?? 'EXISTING_ATTEMPT_NOT_REPLAYABLE',
        idempotentReplay: true,
      };
    }

    const body = {
      customer: {
        name: input.customer.name.trim(),
        phone: input.customer.phone.trim(),
        email: input.customer.email.trim().toLowerCase(),
        ...(input.customer.address ? { address: input.customer.address.trim() } : {}),
        identity: {
          number: input.customer.identity.number,
          type: input.customer.identity.type,
        },
      },
      reference: reservation.reference,
      redirect_url: settings.redirectUrl,
      kyc_level: 'custom',
      identities: [...input.identities],
      bank_accounts: false,
    };

    let response;
    try {
      response = await this.transport.post(
        MONO_PROVE_INITIATE_URL,
        { accept: 'application/json', 'content-type': 'application/json', 'mono-sec-key': settings.secretKey },
        body,
        REQUEST_TIMEOUT_MS,
      );
    } catch {
      const persisted = await this.appendQuietly(reservation, input, 'UNAVAILABLE', null, null, 'TRANSPORT_UNAVAILABLE');
      return unavailable(reservation.evidenceId, reservation.reference, persisted ? 'TRANSPORT_UNAVAILABLE' : 'EVIDENCE_APPEND_FAILED');
    }

    const rawPayloadSha256 = hashSafeJson(response.body);
    if (response.status < 200 || response.status >= 300) {
      const status: MonoEvidenceStatus = response.status === 429 || response.status >= 500
        ? 'UNAVAILABLE'
        : 'PROVIDER_FAILED';
      const reason = status === 'UNAVAILABLE' ? 'PROVIDER_TEMPORARILY_UNAVAILABLE' : 'PROVIDER_REJECTED_REQUEST';
      const persisted = await this.appendQuietly(reservation, input, status, null, rawPayloadSha256, reason);
      if (!persisted) return unavailable(reservation.evidenceId, reservation.reference, 'EVIDENCE_APPEND_FAILED');
      return {
        status,
        evidenceId: reservation.evidenceId,
        reference: reservation.reference,
        safeReason: reason,
        idempotentReplay: false,
      };
    }

    const parsed = parseInitiationResponse(response.body);
    if (!parsed) {
      const persisted = await this.appendQuietly(reservation, input, 'UNAVAILABLE', null, rawPayloadSha256, 'INVALID_PROVIDER_RESPONSE');
      return unavailable(reservation.evidenceId, reservation.reference, persisted ? 'INVALID_PROVIDER_RESPONSE' : 'EVIDENCE_APPEND_FAILED');
    }

    try {
      await this.evidence.append({
        evidenceId: reservation.evidenceId,
        applicationId: input.applicationId,
        requirementId: input.requirementId,
        providerKey: 'mono_prove',
        status: 'PENDING',
        occurredAt: new Date(),
        providerReference: reservation.reference,
        providerSessionId: parsed.id,
        rawPayloadSha256,
        safeReason: null,
      });
    } catch {
      // No redirect is returned when evidence cannot be durably appended.
      return unavailable(reservation.evidenceId, reservation.reference, 'EVIDENCE_APPEND_FAILED');
    }
    return {
      status: 'PENDING',
      evidenceId: reservation.evidenceId,
      reference: reservation.reference,
      providerSessionId: parsed.id,
      redirectUrl: parsed.url,
      rawPayloadSha256,
      idempotentReplay: false,
    };
  }

  private async appendQuietly(
    reservation: MonoEvidenceReservation,
    input: MonoProveInitiationInput,
    status: MonoEvidenceStatus,
    providerSessionId: string | null,
    rawPayloadSha256: string | null,
    safeReason: string,
  ): Promise<boolean> {
    try {
      await this.evidence.append({
        evidenceId: reservation.evidenceId,
        applicationId: input.applicationId,
        requirementId: input.requirementId,
        providerKey: 'mono_prove',
        status,
        occurredAt: new Date(),
        providerReference: reservation.reference,
        providerSessionId,
        rawPayloadSha256,
        safeReason,
      });
      return true;
    } catch {
      // Deliberately no payload, exception, or credential logging.
      return false;
    }
  }
}

interface MonoSettings {
  enabled: boolean;
  environment: 'sandbox' | 'live';
  secretKey?: string;
  redirectUrl?: string;
  consentTextVersion?: string;
  consentTextSha256?: string;
  privacyNoticeVersion?: string;
  lawfulBasisVersion?: string;
  lawfulBasisApproved: boolean;
  privacyNoticeApproved: boolean;
  consentTextApproved: boolean;
}

function validateInput(input: MonoProveInitiationInput): string | null {
  if (!input || typeof input !== 'object' || !input.customer || typeof input.customer !== 'object' ||
    !input.customer.identity || typeof input.customer.identity !== 'object') return 'INVALID_CUSTOMER_INPUT';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (![input.applicationId, input.requirementId, input.actorUserId, input.subjectUserId, input.consentRecordId]
    .every((value) => typeof value === 'string' && uuid.test(value))) return 'INVALID_SCOPE';
  if (typeof input.operationKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(input.operationKey)) return 'INVALID_OPERATION_KEY';
  if (!Array.isArray(input.identities) || input.identities.length === 0 ||
    input.identities.some((value) => typeof value !== 'string' || !/^[a-z][a-z0-9_]{0,31}$/.test(value)) ||
    new Set(input.identities).size !== input.identities.length ||
    (!input.identities.includes('bvn') && !input.identities.includes('nin'))) return 'INVALID_RULESET_IDENTITIES';
  if (!['bvn', 'nin'].includes(input.customer.identity.type) || !input.identities.includes(input.customer.identity.type)) {
    return 'IDENTITY_NOT_ALLOWED_BY_RULESET';
  }
  if (typeof input.customer.identity.number !== 'string' || input.customer.identity.number.length !== 11 ||
    !/^\d{11}$/.test(input.customer.identity.number)) return 'INVALID_IDENTITY_INPUT';
  if (typeof input.customer.name !== 'string' || typeof input.customer.phone !== 'string' ||
    typeof input.customer.email !== 'string' || !input.customer.name.trim() || input.customer.name.length > 255 ||
    !input.customer.phone.trim() || input.customer.phone.length > 64 ||
    !/^\S+@\S+\.\S+$/.test(input.customer.email) || input.customer.email.length > 254 ||
    (input.customer.address !== undefined && (typeof input.customer.address !== 'string' || input.customer.address.length > 500))) {
    return 'INVALID_CUSTOMER_INPUT';
  }
  return null;
}

function validReservation(value: unknown): value is MonoEvidenceReservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const reservation = value as Record<string, unknown>;
  const validStatuses: readonly string[] = ['PENDING', 'PROVIDER_VERIFIED', 'AWAITING_REVIEW', 'CANCELLED', 'EXPIRED', 'PROVIDER_FAILED', 'UNAVAILABLE'];
  return typeof reservation.evidenceId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservation.evidenceId) &&
    typeof reservation.reference === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(reservation.reference) &&
    typeof reservation.shouldInitiate === 'boolean' &&
    (reservation.existingStatus === undefined || validStatuses.includes(String(reservation.existingStatus))) &&
    (reservation.providerSessionId === undefined || typeof reservation.providerSessionId === 'string') &&
    (reservation.redirectUrl === undefined || typeof reservation.redirectUrl === 'string');
}

function isSafeRedirectUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash &&
      !['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname.toLowerCase()) && !parsed.hostname.endsWith('.local');
  } catch {
    return false;
  }
}

function isSafeMonoUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && ALLOWED_PROVIDER_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

function parseInitiationResponse(value: unknown): { id: string; url: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : root;
  const id = typeof data.id === 'string' ? data.id : null;
  const url = typeof data.url === 'string' ? data.url : typeof data.link === 'string' ? data.link : null;
  if (!id || id.length > 128 || !url) return null;
  if (!isSafeMonoUrl(url)) return null;
  return { id, url };
}

function hashSafeJson(value: unknown): string {
  let serialized: string;
  try { serialized = JSON.stringify(value) ?? 'null'; } catch { serialized = '[unserializable]'; }
  return createHash('sha256').update(serialized).digest('hex');
}

function unavailable(evidenceId: string | null, reference: string | null, safeReason: string): MonoProveInitiationResult {
  return { status: 'UNAVAILABLE', evidenceId, reference, safeReason, idempotentReplay: false };
}

export const MONO_PROVE_INITIATE = { url: MONO_PROVE_INITIATE_URL, timeoutMs: REQUEST_TIMEOUT_MS, maxAttempts: MAX_ATTEMPTS } as const;
