import { ConfigService } from '@nestjs/config';
import { MonoProveWebhookProcessor, normalizeWebhook } from './mono-prove-webhook.processor';
import { MonoEvidenceAppend, MonoEvidenceJournal, MonoWebhookEvidenceAppend } from './mono-verification-ports';

const webhook = {
  event: 'mono.prove.data_verification_successful',
  data: {
    id: 'PRV-SYNTHETIC-01',
    reference: 'sf-synthetic-reference-01',
    status: 'successful',
    created_at: '2026-01-01T00:00:00.000Z',
    customer: { name: 'Synthetic Person', email: 'synthetic@example.invalid', phone: '+2348000000000' },
  },
};

function harness() {
  const config = {
    get: (key: string) => key === 'corporate.mono'
      ? { enabled: true, environment: 'sandbox', webhookSecret: 'synthetic-webhook-secret' }
      : undefined,
  } as unknown as ConfigService;
  const seen = new Set<string>();
  const evidence: jest.Mocked<MonoEvidenceJournal> = {
    reserve: jest.fn(),
    append: jest.fn(async (_event: MonoEvidenceAppend): Promise<void> => { void _event; }),
    appendWebhook: jest.fn(async (_event: MonoWebhookEvidenceAppend): Promise<boolean> => {
      if (seen.has(_event.replayDigest)) return false;
      seen.add(_event.replayDigest);
      return true;
    }),
  };
  return { processor: new MonoProveWebhookProcessor(config, evidence), evidence, seen };
}

describe('Mono Prove webhook processing (documented shared-secret header; synthetic events)', () => {
  it('normalizes the documented Prove event without retaining customer data', () => {
    const normalized = normalizeWebhook(webhook);
    expect(normalized).toMatchObject({
      eventName: 'mono.prove.data_verification_successful',
      providerEventId: 'mono.prove.data_verification_successful:PRV-SYNTHETIC-01:2026-01-01T00:00:00.000Z',
      providerSessionId: 'PRV-SYNTHETIC-01',
      reference: 'sf-synthetic-reference-01',
      status: 'PROVIDER_VERIFIED',
    });
    expect(JSON.stringify(normalized)).not.toContain('Synthetic Person');
    expect(normalized.replayDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('supports Mono failed-event nested envelope and maps it to provider failure, not final approval', () => {
    const normalized = normalizeWebhook({
      data: {
        event: 'mono.prove.data_verification_failed',
        data: {
          id: 'PRV-SYNTHETIC-FAILED',
          reference: 'synthetic-reference-failed',
          status: 'failed',
          created_at: '2026-01-01T00:00:00.000Z',
          customer: { name: 'Must Not Persist' },
        },
      },
    });
    expect(normalized.status).toBe('PROVIDER_FAILED');
    expect(JSON.stringify(normalized)).not.toContain('Must Not Persist');
  });

  it('authenticates the Mono shared-secret header and appends one event; exact replay is a no-op', async () => {
    const h = harness();
    await expect(h.processor.process('wrong-secret', webhook)).rejects.toThrow(/Unauthorized request/);

    const first = await h.processor.process('synthetic-webhook-secret', webhook);
    expect(first).toEqual({ duplicate: false, status: 'PROVIDER_VERIFIED' });
    expect(h.evidence.appendWebhook).toHaveBeenCalledTimes(1);
    expect(h.evidence.appendWebhook).toHaveBeenCalledWith(expect.objectContaining({
      providerKey: 'mono_prove',
      providerSessionId: 'PRV-SYNTHETIC-01',
      providerReference: 'sf-synthetic-reference-01',
      status: 'PROVIDER_VERIFIED',
    }));
    expect(JSON.stringify(h.evidence.appendWebhook.mock.calls)).not.toContain('Synthetic Person');

    const replay = await h.processor.process('synthetic-webhook-secret', webhook);
    expect(replay).toEqual({ duplicate: true, status: 'PROVIDER_VERIFIED' });
    expect(h.evidence.appendWebhook).toHaveBeenCalledTimes(2);
    expect(h.seen.size).toBe(1);
  });

  it('rejects unknown or malformed provider events before writing evidence', async () => {
    const h = harness();
    await expect(h.processor.process('synthetic-webhook-secret', { event: 'mono.prove.unknown', data: {} }))
      .rejects.toThrow(/Invalid webhook event/);
    await expect(h.processor.process('synthetic-webhook-secret', {
      ...webhook,
      data: { ...webhook.data, status: 'failed' },
    })).rejects.toThrow(/Invalid webhook event/);
    expect(h.evidence.appendWebhook).not.toHaveBeenCalled();
  });
});
