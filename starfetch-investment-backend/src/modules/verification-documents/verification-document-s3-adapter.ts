import { Inject, Injectable } from '@nestjs/common';
import { INDIVIDUAL_KYC_DOCUMENT_STORAGE, IndividualKycDocumentStorage } from '../individual-kyc/individual-kyc-document-ports';
import { PrivateDocumentStorage } from './document-infrastructure.ports';

/** Reuses the existing OIDC/workload-identity, versioned-private S3 adapter and its fail-closed capability probe. */
@Injectable()
export class VersionedS3PrivateDocumentStorage implements PrivateDocumentStorage {
  constructor(@Inject(INDIVIDUAL_KYC_DOCUMENT_STORAGE) private readonly storage: IndividualKycDocumentStorage) {}

  async putQuarantined(objectKey: string, bytes: Buffer, metadata: { sha256: string; mediaType: string; documentId: string }): Promise<string> {
    return this.storage.putDocumentObject({ documentId: metadata.documentId, objectKey, bytes, contentType: metadata.mediaType, checksumSha256Hex: metadata.sha256 });
  }
  async readQuarantined(objectKey: string, versionId: string): Promise<Buffer> { return this.storage.readDocumentObject(objectKey, versionId); }
  async delete(objectKey: string, versionId: string): Promise<void> { return this.storage.deleteObjectVersion(objectKey, versionId); }
  async createViewAuthorization(objectKey: string, versionId: string, filename: string, expiresInSeconds: number) {
    return this.storage.createViewAuthorization({ objectKey, versionId, filename, expiresInSeconds });
  }
}
