import { HttpException, HttpStatus } from '@nestjs/common';
import { createHash } from 'crypto';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  CORPORATE_KYC_ACCEPTED_CONTENT_TYPES,
  CORPORATE_KYC_MAX_DOCUMENT_BYTES,
  CorporateKycAcceptedContentType,
} from './corporate-kyc-document-requirements';

export interface VerifiedCorporateKycContent {
  readonly contentType: CorporateKycAcceptedContentType;
  readonly sizeBytes: number;
  readonly checksumSha256Hex: string;
}

const PDF_MAGIC = Buffer.from('%PDF-');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IHDR = Buffer.from('IHDR');
/**
 * Clear-text PDF names indicating active/embedded content or encryption that a
 * reviewer cannot safely open. This is a conservative structural heuristic, NOT
 * a malware scan: documents remain `scanStatus: NOT_SCANNED`.
 */
const PDF_DISALLOWED_NAMES = ['/JavaScript', '/JS', '/Launch', '/EmbeddedFile', '/EmbeddedFiles', '/RichMedia', '/XFA', '/Encrypt'];

function unsupported(message: string): HttpException {
  return new HttpException({ code: ERROR_CODES.UNSUPPORTED_FILE_TYPE, message }, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
}

function normalizeDeclaredType(value: string | undefined): string {
  const base = (value ?? '').split(';')[0].trim().toLowerCase();
  return base === 'image/jpg' || base === 'image/pjpeg' ? 'image/jpeg' : base;
}

/** Detects the type purely from the file signature (magic bytes). */
export function detectCorporateKycContentType(bytes: Buffer): CorporateKycAcceptedContentType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 5).equals(PDF_MAGIC) && /^%PDF-[12]\.\d/.test(bytes.subarray(0, 8).toString('latin1'))) return 'application/pdf';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 16 && bytes.subarray(0, 8).equals(PNG_MAGIC) && bytes.subarray(12, 16).equals(PNG_IHDR)) return 'image/png';
  return null;
}

function hasDisallowedPdfName(bytes: Buffer): boolean {
  const text = bytes.toString('latin1');
  return PDF_DISALLOWED_NAMES.some((name) => {
    let from = 0;
    for (;;) {
      const at = text.indexOf(name, from);
      if (at < 0) return false;
      const next = text.charCodeAt(at + name.length);
      // A PDF name ends at whitespace or a delimiter; `/JSON` is not `/JS`.
      if (Number.isNaN(next) || !/[A-Za-z0-9#_.-]/.test(String.fromCharCode(next))) return true;
      from = at + name.length;
    }
  });
}

/**
 * Server-side validation of size, signature and declared type. The browser's
 * declared MIME type and file extension must agree with the detected
 * signature; the detected type is what is stored and served.
 */
export function verifyCorporateKycContent(
  bytes: Buffer,
  declaredContentType: string | undefined,
  originalFilename: string | undefined,
): VerifiedCorporateKycContent {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1) {
    throw new HttpException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Provide one non-empty document file.' }, HttpStatus.BAD_REQUEST);
  }
  if (bytes.length > CORPORATE_KYC_MAX_DOCUMENT_BYTES) {
    throw new HttpException({ code: ERROR_CODES.FILE_TOO_LARGE, message: 'Each document must be 4 MiB or smaller.' }, HttpStatus.PAYLOAD_TOO_LARGE);
  }
  const detected = detectCorporateKycContentType(bytes);
  if (!detected) throw unsupported('Upload a PDF, JPEG or PNG document.');
  const declared = normalizeDeclaredType(declaredContentType);
  if (!(CORPORATE_KYC_ACCEPTED_CONTENT_TYPES as readonly string[]).includes(declared) || declared !== detected) {
    throw unsupported('The file content does not match its declared type. Upload a PDF, JPEG or PNG document.');
  }
  const extension = (originalFilename ?? '').toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  if (extension !== undefined) {
    const allowed = detected === 'application/pdf' ? ['pdf'] : detected === 'image/jpeg' ? ['jpg', 'jpeg'] : ['png'];
    if (!allowed.includes(extension)) throw unsupported('The file extension does not match its content. Upload a PDF, JPEG or PNG document.');
  }
  if (detected === 'application/pdf') {
    const tail = bytes.subarray(Math.max(0, bytes.length - 2048)).toString('latin1');
    if (!tail.includes('%%EOF')) throw unsupported('The PDF appears to be incomplete or damaged.');
    if (hasDisallowedPdfName(bytes)) {
      throw unsupported('Password-protected PDFs and PDFs with scripts, attachments or interactive forms are not accepted. Upload a plain PDF scan.');
    }
  }
  return {
    contentType: detected,
    sizeBytes: bytes.length,
    checksumSha256Hex: createHash('sha256').update(bytes).digest('hex'),
  };
}
