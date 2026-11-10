import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export const MONO_HTTP_TRANSPORT = Symbol('MONO_HTTP_TRANSPORT');
export const MONO_PROVE_CONSENT_AUTHORIZER = Symbol('MONO_PROVE_CONSENT_AUTHORIZER');
export const MONO_EVIDENCE_JOURNAL = Symbol('MONO_EVIDENCE_JOURNAL');

export interface MonoHttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface MonoHttpTransport {
  post(url: string, headers: Readonly<Record<string, string>>, body: unknown, timeoutMs: number): Promise<MonoHttpResponse>;
}

export interface MonoProveAuthorizationRequest {
  readonly applicationId: string;
  readonly requirementId: string;
  readonly actorUserId: string;
  readonly subjectUserId: string;
  readonly consentRecordId: string;
  readonly identities: readonly string[];
}

export interface ApprovedMonoProveConsent {
  readonly applicationId: string;
  readonly subjectUserId: string;
  readonly consentRecordId: string;
  readonly textVersion: string;
  readonly privacyNoticeVersion: string;
  readonly lawfulBasisVersion: string;
  readonly allowedIdentities: readonly string[];
}

export interface MonoProveConsentAuthorizer {
  requireApprovedConsent(input: MonoProveAuthorizationRequest): Promise<ApprovedMonoProveConsent>;
}

export type MonoEvidenceStatus =
  | 'PENDING'
  | 'PROVIDER_VERIFIED'
  | 'AWAITING_REVIEW'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PROVIDER_FAILED'
  | 'UNAVAILABLE';

export interface MonoEvidenceReservation {
  readonly evidenceId: string;
  readonly reference: string;
  /** A durable existing reservation prevents duplicate provider initiation. */
  readonly shouldInitiate: boolean;
  readonly existingStatus?: MonoEvidenceStatus;
  readonly providerSessionId?: string;
  readonly redirectUrl?: string;
}

export interface MonoEvidenceAppend {
  readonly evidenceId: string;
  readonly applicationId: string;
  readonly requirementId: string;
  readonly providerKey: 'mono_prove';
  readonly status: MonoEvidenceStatus;
  readonly occurredAt: Date;
  readonly providerReference: string;
  readonly providerSessionId: string | null;
  readonly rawPayloadSha256: string | null;
  readonly safeReason: string | null;
}

export interface MonoWebhookEvidenceAppend {
  readonly providerKey: 'mono_prove';
  readonly providerEventId: string;
  readonly providerSessionId: string;
  readonly providerReference: string;
  readonly status: MonoEvidenceStatus;
  readonly occurredAt: Date;
  readonly replayDigest: string;
}

export interface MonoEvidenceJournal {
  reserve(input: {
    readonly applicationId: string;
    readonly requirementId: string;
    readonly actorUserId: string;
    readonly subjectUserId: string;
    readonly consentRecordId: string;
    readonly consentTextVersion: string;
    readonly identities: readonly string[];
    readonly operationKey: string;
  }): Promise<MonoEvidenceReservation>;
  append(input: MonoEvidenceAppend): Promise<void>;
  /** Atomically inserts the replay digest and sanitized evidence event; false is an exact replay. */
  appendWebhook(input: MonoWebhookEvidenceAppend): Promise<boolean>;
}

/** Default consent policy is deny-all until approved consent persistence is wired. */
@Injectable()
export class DenyAllMonoProveConsentAuthorizer implements MonoProveConsentAuthorizer {
  async requireApprovedConsent(): Promise<ApprovedMonoProveConsent> {
    throw new HttpException(
      { code: 'FEATURE_UNAVAILABLE', message: 'Approved verification consent is not configured.' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** Default evidence sink is deny-all; no provider call is made without durable append-only evidence. */
@Injectable()
export class DisabledMonoEvidenceJournal implements MonoEvidenceJournal {
  async reserve(): Promise<MonoEvidenceReservation> {
    throw new HttpException(
      { code: 'FEATURE_UNAVAILABLE', message: 'Provider evidence storage is not configured.' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  async append(): Promise<void> {
    throw new HttpException(
      { code: 'FEATURE_UNAVAILABLE', message: 'Provider evidence storage is not configured.' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  async appendWebhook(): Promise<boolean> {
    throw new HttpException(
      { code: 'FEATURE_UNAVAILABLE', message: 'Provider evidence storage is not configured.' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
