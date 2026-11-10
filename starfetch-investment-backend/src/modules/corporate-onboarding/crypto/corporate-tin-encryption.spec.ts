import { DecryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms';
import { AwsKmsCorporateTinEncryptionProvider, TestCorporateTinEncryptionProvider } from './corporate-tin-encryption';

const SYNTHETIC_TIN = 'SYNTHETIC-TIN-NOT-A-REAL-CUSTOMER';
const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';
const WRAPPING_KEY = Buffer.alloc(32, 0x5a);

describe('Corporate TIN envelope encryption', () => {
  it('test provider round-trips synthetic data with envelope-encrypted data keys and authenticated context', async () => {
    const provider = new TestCorporateTinEncryptionProvider(WRAPPING_KEY);
    const record = await provider.encrypt(SYNTHETIC_TIN, APPLICATION_ID);
    expect(record.keyProvider).toBe('TEST_AES_GCM');
    expect(record.keyId).toBe('test-only-synthetic-key');
    expect(record.ciphertext).not.toContain(SYNTHETIC_TIN);
    expect(record.encryptedDataKey).not.toContain(SYNTHETIC_TIN);
    const plaintext = await provider.decrypt(record, APPLICATION_ID);
    expect(plaintext.toString('utf8')).toBe(SYNTHETIC_TIN);
    plaintext.fill(0);
  });

  it('rejects ciphertext tampering, wrong application context and wrong wrapping key', async () => {
    const provider = new TestCorporateTinEncryptionProvider(WRAPPING_KEY);
    const record = await provider.encrypt(SYNTHETIC_TIN, APPLICATION_ID);
    const tampered = { ...record, ciphertext: Buffer.from('tampered').toString('base64') };
    await expect(provider.decrypt(tampered, APPLICATION_ID)).rejects.toMatchObject({ status: 503 });
    await expect(provider.decrypt(record, '22222222-2222-4222-8222-222222222222')).rejects.toMatchObject({ status: 503 });
    await expect(new TestCorporateTinEncryptionProvider(Buffer.alloc(32, 0x6b)).decrypt(record, APPLICATION_ID))
      .rejects.toMatchObject({ status: 503 });
  });

  it('uses KMS GenerateDataKey and Decrypt with the exact application-bound encryption context', async () => {
    const dataKey = Buffer.alloc(32, 0x31);
    const kms = {
      send: jest.fn()
        .mockResolvedValueOnce({ Plaintext: dataKey, CiphertextBlob: Buffer.from('synthetic-wrapped-key'), KeyId: 'arn:aws:kms:synthetic:key/versioned' })
        .mockResolvedValueOnce({ Plaintext: dataKey }),
    };
    const config = { get: (key: string) => ({
      'corporate.o2.kmsKeyId': 'arn:aws:kms:synthetic:key/current',
      'corporate.o2.kmsKeyVersion': 'kms-v7',
      nodeEnv: 'test',
    }[key]) };
    const provider = new AwsKmsCorporateTinEncryptionProvider(config as any, kms as any);
    const record = await provider.encrypt(SYNTHETIC_TIN, APPLICATION_ID);
    expect(kms.send.mock.calls[0][0]).toBeInstanceOf(GenerateDataKeyCommand);
    expect(kms.send.mock.calls[0][0].input).toMatchObject({
      KeyId: 'arn:aws:kms:synthetic:key/current',
      KeySpec: 'AES_256',
      EncryptionContext: {
        applicationId: APPLICATION_ID,
        environment: 'test',
        field: 'taxIdentificationNumber',
        purpose: 'starfetch:corporate-o2:tin:v1',
        contextVersion: '1',
      },
    });
    expect(record.keyId).toBe('arn:aws:kms:synthetic:key/versioned');
    expect(record.keyVersion).toBe('kms-v7');
    const result = await provider.decrypt(record, APPLICATION_ID);
    expect(kms.send.mock.calls[1][0]).toBeInstanceOf(DecryptCommand);
    expect(kms.send.mock.calls[1][0].input).toMatchObject({ KeyId: record.keyId });
    expect(result.toString('utf8')).toBe(SYNTHETIC_TIN);
    result.fill(0);
  });

  it('fails closed when KMS is unavailable or the configured key is missing', async () => {
    const failing = new AwsKmsCorporateTinEncryptionProvider(
      { get: () => 'arn:aws:kms:synthetic:key/current' } as any,
      { send: jest.fn().mockRejectedValue(new Error('synthetic KMS failure')) } as any,
    );
    await expect(failing.encrypt(SYNTHETIC_TIN, APPLICATION_ID)).rejects.toMatchObject({ status: 503 });
    const missing = new AwsKmsCorporateTinEncryptionProvider(
      { get: () => undefined } as any,
      { send: jest.fn() } as any,
    );
    await expect(missing.encrypt(SYNTHETIC_TIN, APPLICATION_ID)).rejects.toMatchObject({ status: 503 });
  });
});
