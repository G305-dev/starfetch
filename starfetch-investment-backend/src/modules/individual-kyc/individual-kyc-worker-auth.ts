import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export const KYC_WORKER_AUTH_HEADERS = {
  workerId: 'x-starfetch-kyc-worker-id',
  timestamp: 'x-starfetch-kyc-worker-timestamp',
  nonce: 'x-starfetch-kyc-worker-nonce',
  signature: 'x-starfetch-kyc-worker-signature',
} as const;

export interface AuthenticatedKycWorkerRequest {
  individualKycWorkerId?: string;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

export function workerSignature(input: {
  readonly method: string;
  readonly path: string;
  readonly timestamp: string;
  readonly nonce: string;
  readonly workerId: string;
  readonly body: unknown;
  readonly key: Buffer;
}): string {
  const bodyDigest = createHash('sha256').update(canonicalJson(input.body)).digest('hex');
  const message = [input.method.toUpperCase(), input.path, input.timestamp, input.nonce, input.workerId, bodyDigest].join('\n');
  return createHmac('sha256', input.key).update(message).digest('hex');
}

@Injectable()
export class IndividualKycWorkerAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
      body?: unknown;
      headers: Record<string, string | string[] | undefined>;
      individualKycWorkerId?: string;
    }>();
    if (this.config.get<boolean>('individualKyc.scannerWorkerEnabled') !== true) throw new ForbiddenException();
    const encodedKey = this.config.get<string>('individualKyc.workerHmacKey');
    if (!encodedKey) throw new ForbiddenException();
    const workerId = singleHeader(request.headers[KYC_WORKER_AUTH_HEADERS.workerId]);
    const timestamp = singleHeader(request.headers[KYC_WORKER_AUTH_HEADERS.timestamp]);
    const nonce = singleHeader(request.headers[KYC_WORKER_AUTH_HEADERS.nonce]);
    const signature = singleHeader(request.headers[KYC_WORKER_AUTH_HEADERS.signature]);
    if (!workerId || !/^[A-Za-z0-9._-]{1,80}$/.test(workerId) ||
        !timestamp || !/^\d{13}$/.test(timestamp) || !nonce || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) ||
        !signature || !/^[0-9a-f]{64}$/.test(signature)) throw new UnauthorizedException();
    if (Math.abs(Date.now() - Number(timestamp)) > 60_000) throw new UnauthorizedException();
    const path = request.originalUrl ?? request.url ?? '';
    if (!path.startsWith('/api/v1/internal/individual-kyc/')) throw new UnauthorizedException();
    let expected: string;
    try {
      expected = workerSignature({
        method: request.method,
        path,
        timestamp,
        nonce,
        workerId,
        body: request.body ?? {},
        key: Buffer.from(encodedKey, 'base64'),
      });
    } catch {
      throw new UnauthorizedException();
    }
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    try {
      const nonceHash = createHash('sha256').update(nonce).digest('hex');
      const now = new Date();
      await this.prisma.individualKycWorkerRequestNonce.deleteMany({ where: { expiresAt: { lte: now } } });
      await this.prisma.individualKycWorkerRequestNonce.create({ data: {
        nonceHash,
        workerId,
        expiresAt: new Date(now.getTime() + 2 * 60 * 1000),
      } });
    } catch {
      // Unique collisions, unavailable DB, and replay are indistinguishable to callers.
      throw new UnauthorizedException();
    }
    request.individualKycWorkerId = workerId;
    return true;
  }
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
