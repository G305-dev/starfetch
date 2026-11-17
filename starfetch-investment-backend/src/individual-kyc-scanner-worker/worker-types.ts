export interface IndividualKycScanJob {
  readonly documentId: string;
  readonly objectKey: string;
  readonly objectVersionId: string;
  readonly contentType: 'application/pdf' | 'image/jpeg' | 'image/png';
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly scanRequestedAt: string;
  readonly scanJobToken: string;
}

export interface IndividualKycScanJobResult {
  readonly outcome: 'CLEAN' | 'INFECTED' | 'FAILED';
  readonly objectVersionId: string;
  readonly sha256Base64: string;
  readonly scannerEngine: 'clamd';
  readonly scannerVersion: string | null;
  readonly scannedAt: string;
  readonly scanJobToken: string;
}
