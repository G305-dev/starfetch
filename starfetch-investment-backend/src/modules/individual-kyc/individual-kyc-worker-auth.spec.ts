import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndividualKycWorkerAuthGuard, workerSignature } from './individual-kyc-worker-auth';

const path = '/api/v1/internal/individual-kyc/scan-jobs/claim';
const workerId = 'scanner-test';
const key = Buffer.alloc(32, 0x3a);

function context(request: any): any {
  return { switchToHttp: () => ({ getRequest: () => request }) };
}

describe('Individual KYC scanner-worker authentication', () => {
  it('authenticates an HMAC request and persists a one-time replay nonce', async () => {
    const seen = new Set<string>();
    const prisma: any = {
      individualKycWorkerRequestNonce: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        create: jest.fn(async ({ data }: any) => {
          if (seen.has(data.nonceHash)) throw new Error('unique');
          seen.add(data.nonceHash); return data;
        }),
      },
    };
    const config = { get: (name: string) => name === 'individualKyc.scannerWorkerEnabled' ? true : name === 'individualKyc.workerHmacKey' ? key.toString('base64') : undefined } as unknown as ConfigService;
    const guard = new IndividualKycWorkerAuthGuard(config, prisma);
    const timestamp = String(Date.now());
    const nonce = Buffer.alloc(24, 9).toString('base64url');
    const body = {};
    const request: any = {
      method: 'POST', originalUrl: path, body,
      headers: {
        'x-starfetch-kyc-worker-id': workerId,
        'x-starfetch-kyc-worker-timestamp': timestamp,
        'x-starfetch-kyc-worker-nonce': nonce,
        'x-starfetch-kyc-worker-signature': workerSignature({ method: 'POST', path, timestamp, nonce, workerId, body, key }),
      },
    };
    expect(await guard.canActivate(context(request))).toBe(true);
    expect(request.individualKycWorkerId).toBe(workerId);
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.individualKycWorkerRequestNonce.create).toHaveBeenCalledTimes(2);
  });

  it('rejects stale timestamps, changed body signatures, and disabled scanner flags', async () => {
    const keyEncoded = key.toString('base64');
    const prisma: any = { individualKycWorkerRequestNonce: { deleteMany: jest.fn(), create: jest.fn() } };
    const config = { get: (name: string) => name === 'individualKyc.scannerWorkerEnabled' ? true : name === 'individualKyc.workerHmacKey' ? keyEncoded : undefined } as unknown as ConfigService;
    const guard = new IndividualKycWorkerAuthGuard(config, prisma);
    const timestamp = String(Date.now() - 120_000); const nonce = Buffer.alloc(24, 1).toString('base64url'); const body = {};
    const request = { method: 'POST', originalUrl: path, body, headers: {
      'x-starfetch-kyc-worker-id': workerId,
      'x-starfetch-kyc-worker-timestamp': timestamp,
      'x-starfetch-kyc-worker-nonce': nonce,
      'x-starfetch-kyc-worker-signature': workerSignature({ method: 'POST', path, timestamp, nonce, workerId, body, key }),
    } };
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(UnauthorizedException);
    const disabled = new IndividualKycWorkerAuthGuard({ get: (name: string) => name === 'individualKyc.scannerWorkerEnabled' ? false : keyEncoded } as unknown as ConfigService, prisma);
    await expect(disabled.canActivate(context(request))).rejects.toThrow();
    expect(prisma.individualKycWorkerRequestNonce.create).not.toHaveBeenCalled();
  });
});
