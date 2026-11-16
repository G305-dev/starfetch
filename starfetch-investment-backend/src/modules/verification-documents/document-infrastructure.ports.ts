import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export const PRIVATE_DOCUMENT_STORAGE = Symbol('PRIVATE_DOCUMENT_STORAGE');
export const DOCUMENT_MALWARE_SCANNER = Symbol('DOCUMENT_MALWARE_SCANNER');

export interface PrivateDocumentStorage {
  putQuarantined(objectKey: string, bytes: Buffer, metadata: { sha256: string; mediaType: string; documentId: string }): Promise<string>;
  readQuarantined(objectKey: string, versionId: string): Promise<Buffer>;
  delete(objectKey: string, versionId: string): Promise<void>;
  createViewAuthorization(objectKey: string, versionId: string, filename: string, expiresInSeconds: number): Promise<{ viewUrl: string; expiresAt: Date }>;
}

export interface MalwareScanResult {
  readonly clean: boolean;
  readonly scannerVersion: string;
  readonly safeReason: string | null;
}

export interface DocumentMalwareScanner {
  scan(bytes: Buffer): Promise<MalwareScanResult>;
}

/** Production storage default remains fail-closed until the approved S3 provider reports readiness. */
@Injectable()
export class DisabledPrivateDocumentStorage implements PrivateDocumentStorage {
  async putQuarantined(): Promise<string> { throw unavailable(); }
  async readQuarantined(): Promise<Buffer> { throw unavailable(); }
  async delete(): Promise<void> { throw unavailable(); }
  async createViewAuthorization(): Promise<{ viewUrl: string; expiresAt: Date }> { throw unavailable(); }
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

  async putQuarantined(objectKey: string, bytes: Buffer, metadata: { sha256: string; mediaType: string; documentId: string }): Promise<string> {
    if (this.nodeEnv !== 'test' || this.objects.has(objectKey) || !metadata.documentId) throw unavailable();
    this.objects.set(objectKey, Buffer.from(bytes));
    return `test-version-${this.objects.size}`;
  }

  async createViewAuthorization(objectKey: string, versionId: string, filename: string, expiresInSeconds: number): Promise<{ viewUrl: string; expiresAt: Date }> {
    if (this.nodeEnv !== 'test' || !this.objects.has(objectKey) || !versionId || !filename || expiresInSeconds < 1 || expiresInSeconds > 60) throw unavailable();
    return { viewUrl: `https://document-view.invalid/${encodeURIComponent(objectKey)}?version=${encodeURIComponent(versionId)}`, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }

  async readQuarantined(objectKey: string, versionId: string): Promise<Buffer> {
    const value = this.objects.get(objectKey);
    if (this.nodeEnv !== 'test' || !value || !/^test-version-[0-9]+$/.test(versionId)) throw unavailable();
    return Buffer.from(value);
  }

  async delete(objectKey: string, versionId: string): Promise<void> {
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
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Private document storage is not configured.' });
}
