import { MonoEvidenceStatus } from './mono-verification-ports';

export const MONO_LOOKUP_HTTP_TRANSPORT = Symbol('MONO_LOOKUP_HTTP_TRANSPORT');
export const MONO_LOOKUP_EVIDENCE_JOURNAL = Symbol('MONO_LOOKUP_EVIDENCE_JOURNAL');

export interface MonoLookupHttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface MonoLookupHttpTransport {
  get(url: string, headers: Readonly<Record<string, string>>, timeoutMs: number): Promise<MonoLookupHttpResponse>;
  post(url: string, headers: Readonly<Record<string, string>>, body: unknown, timeoutMs: number): Promise<MonoLookupHttpResponse>;
}

export interface MonoLookupReservation {
  readonly evidenceId: string;
  readonly reference: string;
  readonly shouldLookup: boolean;
  readonly existingStatus?: MonoEvidenceStatus;
}

export interface MonoLookupEvidenceJournal {
  reserve(input: {
    readonly applicationId: string;
    readonly requirementId: string;
    readonly subjectSnapshotId: string;
    readonly actorUserId: string;
    readonly consentRecordId: string;
    readonly consentTextVersion: string;
    readonly identityKind: 'tin' | 'cac';
    readonly operationKey: string;
  }): Promise<MonoLookupReservation>;
  append(input: {
    readonly evidenceId: string;
    readonly applicationId: string;
    readonly requirementId: string;
    readonly reference: string;
    readonly status: Exclude<MonoEvidenceStatus, 'PENDING'>;
    readonly rawPayloadSha256: string | null;
    readonly safeReason: string | null;
    readonly occurredAt: Date;
  }): Promise<void>;
}
