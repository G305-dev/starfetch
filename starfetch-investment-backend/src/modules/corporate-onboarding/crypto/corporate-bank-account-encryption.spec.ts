import { KMSClient } from '@aws-sdk/client-kms';
import { ConfigService } from '@nestjs/config';
import { CorporateBankAccountEncryptionService } from './corporate-bank-account-encryption';

describe('CorporateBankAccountEncryptionService', () => {
  it('uses a purpose-isolated KMS context and returns a mask only', async () => {
    const key = Buffer.alloc(32, 7);
    const kms = { send: jest.fn()
      .mockResolvedValueOnce({ Plaintext: Buffer.from(key), CiphertextBlob: Buffer.from('wrapped-key'), KeyId: 'arn:aws:kms:region:acct:key/bank' })
      .mockResolvedValueOnce({ Plaintext: Buffer.from(key) }) };
    const config = { get: jest.fn((keyName: string) => ({
      'corporate.bank.kmsKeyId': 'arn:aws:kms:region:acct:key/bank',
      'corporate.bank.kmsKeyVersion': 'bank-v1',
      'platform.isVercel': false,
      nodeEnv: 'test',
    } as Record<string, unknown>)[keyName]) };
    const service = new CorporateBankAccountEncryptionService(config as unknown as ConfigService, kms as unknown as KMSClient);
    const envelope = await service.encrypt('0123456789', 'synthetic-app-id');
    expect(envelope.keyProvider).toBe('AWS_KMS');
    expect(JSON.stringify(envelope)).not.toContain('0123456789');
    const encryptContext = (kms.send.mock.calls[0][0] as any).input.EncryptionContext;
    expect(encryptContext).toMatchObject({
      applicationId: 'synthetic-app-id',
      field: 'bankAccountNumber',
      purpose: 'starfetch:corporate-profile:bank-account:v1',
      contextVersion: '1',
    });
    expect(await service.mask(envelope, 'synthetic-app-id')).toBe('••••••6789');
  });
});
