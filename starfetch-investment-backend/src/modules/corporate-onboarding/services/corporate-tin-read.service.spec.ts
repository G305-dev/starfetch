import { CorporateTinReadService } from './corporate-tin-read.service';

const encrypted = {
  taxIdentificationNumberCiphertext: 'ciphertext',
  taxIdentificationNumberIv: 'iv',
  taxIdentificationNumberAuthTag: 'tag',
  taxIdentificationNumberEncryptedDataKey: 'wrapped',
  taxIdentificationNumberKeyProvider: 'TEST_AES_GCM',
  taxIdentificationNumberKeyId: 'test-only-synthetic-key',
  taxIdentificationNumberKeyVersion: 'test-v1',
  taxIdentificationNumberContextVersion: 1,
};
const empty = Object.fromEntries(Object.keys(encrypted).map((key) => [key, null]));
const enabled = { isAvailable: () => true };
const disabled = { isAvailable: () => false };

describe('CorporateTinReadService', () => {
  it('returns a masked suffix for a normal-length TIN and zeroes the temporary plaintext buffer', async () => {
    const plaintext = Buffer.from('SYNTHETIC-TIN-NOT-A-REAL-CUSTOMER');
    const provider = { decrypt: jest.fn().mockResolvedValue(plaintext) };
    const service = new CorporateTinReadService(provider as any, enabled as any);
    await expect(service.maskedProjection('application-id', encrypted)).resolves.toMatch(/^[•]+OMER$/);
    expect(provider.decrypt).toHaveBeenCalledWith(expect.objectContaining({ keyVersion: 'test-v1' }), 'application-id');
    expect(plaintext.every((byte) => byte === 0)).toBe(true);
  });

  it.each(['7', '1234', '12345678'])('fully masks a short TIN (%s code points) without revealing its characters', async (value) => {
    const plaintext = Buffer.from(value, 'utf8');
    const service = new CorporateTinReadService({ decrypt: jest.fn().mockResolvedValue(plaintext) } as any, enabled as any);
    await expect(service.maskedProjection('application-id', encrypted)).resolves.toBe('••••');
    expect(plaintext.every((byte) => byte === 0)).toBe(true);
  });

  it('masks a normal-length TIN while exposing no more than one quarter of it', async () => {
    const plaintext = Buffer.from('12345678901234', 'utf8');
    const service = new CorporateTinReadService({ decrypt: jest.fn().mockResolvedValue(plaintext) } as any, enabled as any);
    await expect(service.maskedProjection('application-id', encrypted)).resolves.toBe(`${'•'.repeat(11)}234`);
    expect(plaintext.every((byte) => byte === 0)).toBe(true);
  });

  it('caps disclosure at four suffix characters for unusually long TIN values', async () => {
    const value = `${'A'.repeat(120)}Z9Q7`;
    const plaintext = Buffer.from(value, 'utf8');
    const service = new CorporateTinReadService({ decrypt: jest.fn().mockResolvedValue(plaintext) } as any, enabled as any);
    await expect(service.maskedProjection('application-id', encrypted)).resolves.toBe(`${'•'.repeat(120)}Z9Q7`);
    expect(plaintext.every((byte) => byte === 0)).toBe(true);
  });

  it('does not decrypt a stored TIN while the O2 privacy/KMS activation gate is closed', async () => {
    const provider = { decrypt: jest.fn() };
    const service = new CorporateTinReadService(provider as any, disabled as any);
    await expect(service.maskedProjection('application-id', encrypted)).resolves.toBeNull();
    expect(provider.decrypt).not.toHaveBeenCalled();
  });

  it('returns null for a legacy record with no TIN and never attempts decryption', async () => {
    const provider = { decrypt: jest.fn() };
    await expect(new CorporateTinReadService(provider as any, enabled as any).maskedProjection('application-id', empty as any)).resolves.toBeNull();
    expect(provider.decrypt).not.toHaveBeenCalled();
  });

  it('fails closed and exposes no provider details when decryption fails', async () => {
    const service = new CorporateTinReadService({ decrypt: jest.fn().mockRejectedValue(new Error('synthetic provider error')) } as any, enabled as any);
    await expect(service.maskedProjection('application-id', encrypted)).rejects.toMatchObject({
      status: 503,
      response: { code: 'SERVICE_UNAVAILABLE', message: 'Corporate details are temporarily unavailable.' },
    });
  });
});
