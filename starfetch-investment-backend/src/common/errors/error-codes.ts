/**
 * Stable API error-code vocabulary (foundation set).
 * Mirrors the PROPOSED error contract from the Phase-1 contract draft;
 * the full business catalogue is added with later approved endpoints.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: ERROR_CODES.VALIDATION_FAILED,
  401: ERROR_CODES.UNAUTHENTICATED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  413: ERROR_CODES.FILE_TOO_LARGE,
  415: ERROR_CODES.UNSUPPORTED_FILE_TYPE,
  429: ERROR_CODES.RATE_LIMITED,
};

export function errorCodeForStatus(status: number): ErrorCode {
  return STATUS_TO_CODE[status] ?? ERROR_CODES.INTERNAL_ERROR;
}
