import { PasswordService, ARGON2_PARAMS, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from './password.service';

describe('PasswordService (Argon2id contract)', () => {
  const service = new PasswordService();
  const sample = 'a perfectly valid passphrase';

  it('hashes with Argon2id at the approved parameters', async () => {
    const hash = await service.hash(sample);
    // PHC string must claim argon2id with the approved m/t/p parameters
    // (parameter order in the PHC string is implementation-defined).
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toMatch(/\bm=19456\b/);
    expect(hash).toMatch(/\bt=2\b/);
    expect(hash).toMatch(/\bp=1\b/);
    expect(ARGON2_PARAMS.memoryCost).toBeGreaterThanOrEqual(19456);
    expect(ARGON2_PARAMS.timeCost).toBeGreaterThanOrEqual(2);
    expect(ARGON2_PARAMS.parallelism).toBeGreaterThanOrEqual(1);
  });

  it('never stores plaintext and never equals the input', async () => {
    const hash = await service.hash(sample);
    expect(hash).not.toContain(sample);
    expect(hash.length).toBeGreaterThan(60);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await service.hash(sample);
    await expect(service.verify(hash, sample)).resolves.toBe(true);
    await expect(service.verify(hash, 'definitely the wrong passphrase')).resolves.toBe(false);
    await expect(service.verify('not-a-real-hash', sample)).resolves.toBe(false);
  });

  it('equalizes timing with a dummy verify for unknown accounts', async () => {
    await expect(service.verifyOrEqualize(undefined, sample)).resolves.toBe(false);
  });

  it('exposes the approved password policy constants (15–128, no composition rules)', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(15);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });
});
