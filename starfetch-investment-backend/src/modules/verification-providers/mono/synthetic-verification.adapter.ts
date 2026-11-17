import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { MonoEvidenceStatus } from './mono-verification-ports';

export interface SyntheticVerificationResult {
  readonly status: MonoEvidenceStatus;
  readonly reference: string;
  readonly occurredAt: Date;
  readonly payloadHash: string;
  readonly detailMasked: Readonly<Record<string, string | number | boolean>>;
}

/** Test-only adapter. It never performs network I/O and refuses outside NODE_ENV=test. */
@Injectable()
export class SyntheticVerificationAdapter {
  constructor(private readonly config: ConfigService) {}

  result(status: MonoEvidenceStatus, syntheticCase: string): SyntheticVerificationResult {
    if (this.config.get<string>('nodeEnv') !== 'test') {
      throw new Error('Synthetic verification is available only in automated tests.');
    }
    if (!/^[A-Z0-9_-]{1,64}$/.test(syntheticCase)) {
      throw new Error('Invalid synthetic verification case.');
    }
    const canonical = `synthetic-only\u0000${status}\u0000${syntheticCase}`;
    return {
      status,
      reference: `synthetic-${createHash('sha256').update(canonical).digest('hex').slice(0, 20)}`,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      payloadHash: createHash('sha256').update(canonical).digest('hex'),
      detailMasked: { source: 'SYNTHETIC_TEST_ADAPTER', caseKey: syntheticCase },
    };
  }
}
