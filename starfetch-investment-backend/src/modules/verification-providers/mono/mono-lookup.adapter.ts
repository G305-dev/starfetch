import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationConsentService } from '../verification-consent.service';
import { MONO_LOOKUP_EVIDENCE_JOURNAL, MONO_LOOKUP_HTTP_TRANSPORT, MonoLookupEvidenceJournal, MonoLookupHttpTransport, MonoLookupReservation } from './mono-lookup-ports';
import { MonoEvidenceStatus } from './mono-verification-ports';

const TIN_LOOKUP_URL = 'https://api.withmono.com/v3/lookup/tin';
const CAC_LOOKUP_URL = 'https://api.withmono.com/v3/lookup/cac';
const TIMEOUT_MS = 8_000;

export interface MonoLookupInput {
  readonly applicationId: string;
  readonly requirementId: string;
  readonly subjectSnapshotId: string;
  readonly actorUserId: string;
  readonly consentRecordId: string;
  readonly operationKey: string;
  readonly channel: 'tin' | 'cac';
  /** Raw value is passed only to Mono's request body/query; never stored or returned. */
  readonly number: string;
  /** Canonical business name/RC from the applicant's encrypted/durable record. */
  readonly expectedCorporateName: string;
  readonly expectedRcNumber: string;
}

export interface MonoLookupResult {
  readonly status: Exclude<MonoEvidenceStatus, 'PENDING'>;
  readonly evidenceId: string | null;
  readonly reference: string | null;
  readonly safeReason: string;
  readonly idempotentReplay: boolean;
  readonly rawPayloadSha256?: string;
}

interface MonoLookupSettings {
  readonly enabled: boolean;
  readonly environment?: string;
  readonly secretKey?: string;
  readonly consentTextVersion?: string;
  readonly consentTextSha256?: string;
  readonly privacyNoticeVersion?: string;
  readonly lawfulBasisVersion?: string;
  readonly lawfulBasisApproved: boolean;
  readonly privacyNoticeApproved: boolean;
  readonly consentTextApproved: boolean;
}

/** Independent Mono Lookup adapter for CAC and TIN contracts; no PII response is returned. */
@Injectable()
export class MonoLookupAdapter {
  constructor(
    private readonly config: ConfigService,
    private readonly consent: VerificationConsentService,
    @Inject(MONO_LOOKUP_HTTP_TRANSPORT) private readonly transport: MonoLookupHttpTransport,
    @Inject(MONO_LOOKUP_EVIDENCE_JOURNAL) private readonly evidence: MonoLookupEvidenceJournal,
  ) {}

  async verifyBusiness(input: MonoLookupInput): Promise<MonoLookupResult> {
    const settings = this.config.get<MonoLookupSettings>('corporate.monoLookup');
    if (!isEnabled(settings)) return unavailable(null, null, 'FEATURE_DISABLED');
    if (!validInput(input)) return unavailable(null, null, 'INVALID_LOOKUP_REQUEST');

    try {
      await this.consent.requireApprovedLookupConsent({
        applicationId: input.applicationId,
        actorUserId: input.actorUserId,
        consentRecordId: input.consentRecordId,
        identityKind: input.channel,
      });
    } catch {
      return unavailable(null, null, 'APPROVED_CONSENT_REQUIRED');
    }

    let reservation: MonoLookupReservation;
    try {
      reservation = await this.evidence.reserve({
        applicationId: input.applicationId,
        requirementId: input.requirementId,
        subjectSnapshotId: input.subjectSnapshotId,
        actorUserId: input.actorUserId,
        consentRecordId: input.consentRecordId,
        consentTextVersion: settings.consentTextVersion!,
        identityKind: input.channel,
        operationKey: input.operationKey,
      });
    } catch {
      return unavailable(null, null, 'EVIDENCE_JOURNAL_UNAVAILABLE');
    }
    if (!reservation.evidenceId || !reservation.reference) return unavailable(null, null, 'INVALID_EVIDENCE_RESERVATION');
    if (!reservation.shouldLookup) {
      return {
        status: reservation.existingStatus && reservation.existingStatus !== 'PENDING' ? reservation.existingStatus : 'UNAVAILABLE',
        evidenceId: reservation.evidenceId,
        reference: reservation.reference,
        safeReason: 'IDEMPOTENT_REPLAY',
        idempotentReplay: true,
      };
    }

    let response;
    try {
      const headers = { accept: 'application/json', 'content-type': 'application/json', 'mono-sec-key': settings.secretKey! };
      if (input.channel === 'tin') {
        response = await this.transport.post(
          TIN_LOOKUP_URL,
          headers,
          { number: input.number.trim(), channel: 'tin' },
          TIMEOUT_MS,
        );
      } else if (input.channel === 'cac') {
        const url = new URL(CAC_LOOKUP_URL);
        url.searchParams.set('search', input.number.trim());
        response = await this.transport.get(url.toString(), headers, TIMEOUT_MS);
      } else {
        const url = new URL(TIN_LOOKUP_URL);
        response = await this.transport.post(url.toString(), headers, { number: input.number.trim(), channel: input.channel }, TIMEOUT_MS);
      }
    } catch {
      return await this.finish(reservation, input, 'UNAVAILABLE', 'TRANSPORT_UNAVAILABLE', null);
    }

    const rawPayloadSha256 = safeBodyHash(response.body);
    if (response.status < 200 || response.status >= 300) {
      const transient = response.status === 429 || response.status >= 500;
      return await this.finish(
        reservation,
        input,
        transient ? 'UNAVAILABLE' : 'PROVIDER_FAILED',
        transient ? 'PROVIDER_TEMPORARILY_UNAVAILABLE' : 'PROVIDER_REJECTED_REQUEST',
        rawPayloadSha256,
      );
    }

    const match = input.channel === 'tin'
      ? tinResponseMatches(response.body, input.expectedCorporateName)
      : cacResponseMatches(response.body, input.expectedRcNumber);
    if (match === null) return await this.finish(reservation, input, 'UNAVAILABLE', 'INVALID_PROVIDER_RESPONSE', rawPayloadSha256);
    return await this.finish(
      reservation,
      input,
      match ? 'PROVIDER_VERIFIED' : 'PROVIDER_FAILED',
      match ? 'PROVIDER_MATCHED' : 'PROVIDER_DATA_MISMATCH',
      rawPayloadSha256,
    );
  }

  private async finish(
    reservation: MonoLookupReservation,
    input: MonoLookupInput,
    status: Exclude<MonoEvidenceStatus, 'PENDING'>,
    reason: string,
    rawPayloadSha256: string | null,
  ): Promise<MonoLookupResult> {
    try {
      await this.evidence.append({
        evidenceId: reservation.evidenceId,
        applicationId: input.applicationId,
        requirementId: input.requirementId,
        reference: reservation.reference,
        status,
        rawPayloadSha256,
        safeReason: reason,
        occurredAt: new Date(),
      });
    } catch {
      return unavailable(reservation.evidenceId, reservation.reference, 'EVIDENCE_APPEND_FAILED');
    }
    return { status, evidenceId: reservation.evidenceId, reference: reservation.reference, safeReason: reason, idempotentReplay: false, rawPayloadSha256: rawPayloadSha256 ?? undefined };
  }
}

function isEnabled(settings: MonoLookupSettings | undefined): settings is MonoLookupSettings & { secretKey: string } {
  return Boolean(settings?.enabled && settings.environment === 'sandbox' && /^test_sk_[A-Za-z0-9_-]+$/.test(settings.secretKey ?? '') &&
    settings.lawfulBasisApproved && settings.privacyNoticeApproved && settings.consentTextApproved &&
    settings.consentTextVersion && settings.consentTextSha256 && /^[0-9a-f]{64}$/.test(settings.consentTextSha256) &&
    settings.privacyNoticeVersion && settings.lawfulBasisVersion);
}

function validInput(input: MonoLookupInput): boolean {
  if (!input || !UUID.test(input.applicationId) || !UUID.test(input.requirementId) || !UUID.test(input.subjectSnapshotId) ||
    !UUID.test(input.actorUserId) || !UUID.test(input.consentRecordId) || typeof input.operationKey !== 'string' ||
    input.operationKey.length < 16 || input.operationKey.length > 256 || !['tin', 'cac'].includes(input.channel) ||
    typeof input.number !== 'string' || input.number.trim().length < 3 || input.number.length > 128 || hasControlCharacters(input.number) ||
    typeof input.expectedCorporateName !== 'string' || input.expectedCorporateName.trim().length < 2 || input.expectedCorporateName.length > 200 ||
    typeof input.expectedRcNumber !== 'string' || input.expectedRcNumber.trim().length < 2 || input.expectedRcNumber.length > 64) return false;
  return true;
}

function tinResponseMatches(body: unknown, expectedName: string): boolean | null {
  if (!isRecord(body) || body.status !== 'successful' || !isRecord(body.data)) return null;
  const data = body.data;
  if (typeof data.tin_type !== 'string' || data.tin_type.toUpperCase() !== 'CORPORATE' || typeof data.taxpayer_name !== 'string') return false;
  return normalizeBusinessName(data.taxpayer_name) === normalizeBusinessName(expectedName);
}

function cacResponseMatches(body: unknown, expectedRc: string): boolean | null {
  if (!isRecord(body) || body.status !== 'successful' || !Array.isArray(body.data)) return null;
  const canonicalRc = normalizeRc(expectedRc);
  const candidates = body.data.filter(isRecord).filter((candidate) =>
    typeof candidate.rc_number === 'string' && normalizeRc(candidate.rc_number) === canonicalRc,
  );
  if (candidates.length === 0) return false;
  return candidates.some((candidate) => candidate.active === true && candidate.registration_approved === true);
}

function normalizeBusinessName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-NG');
}

function normalizeRc(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, '').toLocaleUpperCase('en-NG');
}

function safeBodyHash(value: unknown): string | null {
  try {
    return createHash('sha256').update(JSON.stringify(value) ?? 'null', 'utf8').digest('hex');
  } catch {
    return null;
  }
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unavailable(evidenceId: string | null, reference: string | null, safeReason: string): MonoLookupResult {
  return { status: 'UNAVAILABLE', evidenceId, reference, safeReason, idempotentReplay: false };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
