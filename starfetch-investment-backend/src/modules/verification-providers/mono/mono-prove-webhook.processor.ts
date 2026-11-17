import { createHash, timingSafeEqual } from 'crypto';
import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MONO_EVIDENCE_JOURNAL,
  MonoEvidenceJournal,
  MonoEvidenceStatus,
} from './mono-verification-ports';

const PROVE_EVENTS: Readonly<Record<string, { status: MonoEvidenceStatus; providerStatus: string }>> = {
  'mono.prove.data_verification_initiated': { status: 'PENDING', providerStatus: 'pending' },
  'mono.prove.data_verification_successful': { status: 'PROVIDER_VERIFIED', providerStatus: 'successful' },
  'mono.prove.data_verification_awaiting_review': { status: 'AWAITING_REVIEW', providerStatus: 'awaiting_review' },
  'mono.prove.data_verification_cancelled': { status: 'CANCELLED', providerStatus: 'cancelled' },
  'mono.prove.data_verification_expired': { status: 'EXPIRED', providerStatus: 'expired' },
  'mono.prove.data_verification_rejected': { status: 'PROVIDER_FAILED', providerStatus: 'rejected' },
  'mono.prove.data_verification_failed': { status: 'PROVIDER_FAILED', providerStatus: 'failed' },
};

export interface NormalizedMonoProveWebhook {
  readonly eventName: string;
  readonly providerEventId: string;
  readonly providerSessionId: string;
  readonly reference: string;
  readonly status: MonoEvidenceStatus;
  readonly occurredAt: Date;
  readonly replayDigest: string;
}

/** Authenticates the documented mono-webhook-secret header and atomically journals/deduplicates events. */
@Injectable()
export class MonoProveWebhookProcessor {
  constructor(
    private readonly config: ConfigService,
    @Inject(MONO_EVIDENCE_JOURNAL) private readonly evidence: MonoEvidenceJournal,
  ) {}

  async process(headerValue: string | undefined, body: unknown): Promise<{ duplicate: boolean; status: MonoEvidenceStatus }> {
    const settings = this.config.get<MonoWebhookSettings>('corporate.mono');
    if (!settings?.enabled || settings.environment !== 'sandbox' || !settings.webhookSecret) {
      throw new HttpException(
        { code: 'FEATURE_UNAVAILABLE', message: 'Mono Prove webhook is not enabled.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!constantTimeSecretEqual(headerValue, settings.webhookSecret)) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Unauthorized request.' });
    }
    let normalized: NormalizedMonoProveWebhook;
    try { normalized = normalizeWebhook(body); } catch {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Invalid webhook event.' });
    }
    const appended = await this.evidence.appendWebhook({
      providerKey: 'mono_prove',
      providerEventId: normalized.providerEventId,
      providerSessionId: normalized.providerSessionId,
      providerReference: normalized.reference,
      status: normalized.status,
      occurredAt: normalized.occurredAt,
      replayDigest: normalized.replayDigest,
    });
    return { duplicate: !appended, status: normalized.status };
  }
}

interface MonoWebhookSettings {
  enabled: boolean;
  environment: 'sandbox' | 'live';
  webhookSecret?: string;
}

function constantTimeSecretEqual(received: string | undefined, expected: string): boolean {
  if (!received || !expected) return false;
  const actualDigest = createHash('sha256').update(received, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function normalizeWebhook(body: unknown): NormalizedMonoProveWebhook {
  if (!isRecord(body)) throw new Error('Invalid Mono Prove webhook.');
  // Mono's documented failed-event example wraps an event inside data.data;
  // other Prove examples use the outer {event,data} shape.
  let eventContainer: Record<string, unknown> = body;
  if (isRecord(body.data) && typeof body.data.event === 'string' && isRecord(body.data.data)) {
    eventContainer = body.data as Record<string, unknown>;
  }
  const eventName = typeof eventContainer.event === 'string' ? eventContainer.event : '';
  const eventDefinition = PROVE_EVENTS[eventName];
  const data = isRecord(eventContainer.data) ? eventContainer.data : null;
  const providerStatus = data && typeof data.status === 'string' ? data.status : '';
  const status = eventDefinition?.status;
  const providerSessionId = data && typeof data.id === 'string' ? data.id : '';
  const reference = data && typeof data.reference === 'string' ? data.reference : '';
  const occurredAtRaw = data && typeof data.created_at === 'string'
    ? data.created_at
    : typeof eventContainer.timestamp === 'string' ? eventContainer.timestamp : '';
  const occurredAt = new Date(occurredAtRaw);
  const providerEventId = typeof eventContainer.event_id === 'string' && eventContainer.event_id.length > 0
    ? eventContainer.event_id
    : `${eventName}:${providerSessionId}:${occurredAtRaw}`;
  if (!eventDefinition || !status || providerStatus !== eventDefinition.providerStatus ||
    !providerSessionId || providerSessionId.length > 128 || !reference || reference.length > 128 ||
    !Number.isFinite(occurredAt.getTime()) || providerEventId.length > 256) {
    throw new Error('Invalid Mono Prove webhook.');
  }
  const replayDigest = createHash('sha256')
    .update(`${providerEventId}\u0000${eventName}\u0000${providerSessionId}\u0000${reference}`)
    .digest('hex');
  return { eventName, providerEventId, providerSessionId, reference, status, occurredAt, replayDigest };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
