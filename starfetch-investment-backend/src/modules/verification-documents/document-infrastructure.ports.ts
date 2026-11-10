import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export const PRIVATE_DOCUMENT_STORAGE = Symbol('PRIVATE_DOCUMENT_STORAGE');
export const DOCUMENT_MALWARE_SCANNER = Symbol('DOCUMENT_MALWARE_SCANNER');

export interface PrivateDocumentStorage {
  putQuarantined(objectKey: string, bytes: Buffer, metadata: { sha256: string; mediaType: string }): Promise<void>;
  readQuarantined(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}

export interface MalwareScanResult {
  readonly clean: boolean;
  readonly scannerVersion: string;
  readonly safeReason: string | null;
}

export interface DocumentMalwareScanner {
  scan(bytes: Buffer): Promise<MalwareScanResult>;
}

/** Production default until private storage and malware scanning are approved and configured. */
@Injectable()
export class DisabledPrivateDocumentStorage implements PrivateDocumentStorage {
  async putQuarantined(): Promise<void> { throw unavailable(); }
  async readQuarantined(): Promise<Buffer> { throw unavailable(); }
  async delete(): Promise<void> { throw unavailable(); }
}

/** Production default; files can never be marked clean without an approved scanner. */
@Injectable()
export class DisabledDocumentMalwareScanner implements DocumentMalwareScanner {
  async scan(): Promise<MalwareScanResult> { throw unavailable(); }
}

/** In-memory adapter is test-only and is not registered by the production module. */
export class IsolatedMemoryDocumentStorage implements PrivateDocumentStorage {
  private readonly objects = new Map<string, Buffer>();

  constructor(private readonly nodeEnv: string) {
    if (nodeEnv !== 'test') throw new Error('Isolated document storage is test-only.');
  }

  async putQuarantined(objectKey: string, bytes: Buffer): Promise<void> {
    if (this.nodeEnv !== 'test' || this.objects.has(objectKey)) throw unavailable();
    this.objects.set(objectKey, Buffer.from(bytes));
  }

  async readQuarantined(objectKey: string): Promise<Buffer> {
    const value = this.objects.get(objectKey);
    if (this.nodeEnv !== 'test' || !value) throw unavailable();
    return Buffer.from(value);
  }

  async delete(objectKey: string): Promise<void> {
    const bytes = this.objects.get(objectKey);
    bytes?.fill(0);
    this.objects.delete(objectKey);
  }
}

export class SyntheticTestMalwareScanner implements DocumentMalwareScanner {
  constructor(private readonly nodeEnv: string, private readonly clean = true) {
    if (nodeEnv !== 'test') throw new Error('Synthetic document scanner is test-only.');
  }

  async scan(bytes: Buffer): Promise<MalwareScanResult> {
    if (this.nodeEnv !== 'test' || bytes.length === 0) throw unavailable();
    return { clean: this.clean, scannerVersion: 'synthetic-test-scanner-v1', safeReason: this.clean ? null : 'SYNTHETIC_REJECT' };
  }
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Private document storage and scanning are not configured.' });
}
