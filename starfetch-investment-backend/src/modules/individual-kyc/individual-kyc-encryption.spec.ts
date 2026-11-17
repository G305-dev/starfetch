import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KMSClient } from '@aws-sdk/client-kms';
import { AwsKmsIndividualKycEncryptionProvider, TestIndividualKycEncryptionProvider } from './individual-kyc-encryption';

describe('Individual KYC purpose-separated encryption', () => {
  it('round-trips a synthetic envelope only in test and binds it to profile and owner', async () => {
    const provider = new TestIndividualKycEncryptionProvider('test', Buffer.alloc(32, 7));
    const envelope = await provider.encrypt('synthetic KYC payload', 'profile-a', 'investor-a');
    expect(envelope.encryptionKeyProvider).toBe('TEST_AES_GCM');
    expect((await provider.decrypt(envelope, 'profile-a', 'investor-a')).toString()).toBe('synthetic KYC payload');
    await expect(provider.decrypt(envelope, 'profile-a', 'investor-b')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(() => new TestIndividualKycEncryptionProvider('production', Buffer.alloc(32, 7))).toThrow();
  });

  it('does not call KMS or persist sensitive data before regional approval and dedicated key configuration', async () => {
    const config = { get: jest.fn((key: string) => ({
      'individualKyc.dataResidencyApproved': false,
      'individualKyc.kmsKeyId': 'key',
      'individualKyc.kmsKeyVersion': 'v1',
    } as Record<string, unknown>)[key]) } as unknown as ConfigService;
    const kms = { send: jest.fn() } as unknown as KMSClient;
    const provider = new AwsKmsIndividualKycEncryptionProvider(config, kms);
    await expect(provider.encrypt('synthetic payload', 'profile-a', 'investor-a')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(kms.send).not.toHaveBeenCalled();
  });
});
