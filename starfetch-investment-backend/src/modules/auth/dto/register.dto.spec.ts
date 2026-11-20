jest.mock('argon2', () => ({ argon2id: 2, hash: jest.fn(), verify: jest.fn() }));
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

const BASE = { email: 'applicant@example.invalid', password: 'a long synthetic passphrase' };

describe('RegisterDto Corporate applicant contract', () => {
  async function errors(payload: Record<string, unknown>) {
    return validate(plainToInstance(RegisterDto, payload), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  }

  it('accepts the exact fixed-frontend Corporate payload without Individual names', async () => {
    expect(await errors({
      ...BASE, registrationType: 'CORPORATE', companyName: 'Example Holdings Limited', companyPhoneNumber: '+2348000000000',
    })).toHaveLength(0);
  });

  it('requires and bounds both Corporate applicant display fields', async () => {
    const missing = await errors({ ...BASE, registrationType: 'CORPORATE' });
    expect(missing.map(({ property }) => property)).toEqual(expect.arrayContaining(['companyName', 'companyPhoneNumber']));
    const invalidPhone = await errors({ ...BASE, registrationType: 'CORPORATE', companyName: 'Example', companyPhoneNumber: 'bad' });
    expect(invalidPhone.some((error) => error.property === 'companyPhoneNumber')).toBe(true);
  });

  it('preserves the legacy Individual default and requires its names', async () => {
    const result = await errors(BASE);
    expect(result.map(({ property }) => property)).toEqual(expect.arrayContaining(['firstName', 'lastName']));
    expect(await errors({ ...BASE, registrationType: 'INDIVIDUAL', firstName: 'Ada', lastName: 'Lovelace' }))
      .toHaveLength(0);
  });

  it('rejects unknown registration types, role escalation, and extra fields', async () => {
    expect(await errors({ ...BASE, registrationType: 'STAFF' })).not.toHaveLength(0);
    expect(await errors({ ...BASE, registrationType: null })).not.toHaveLength(0);
    const extra = await errors({ ...BASE, registrationType: 'CORPORATE', role: 'ADMIN' });
    expect(extra.some((error) => error.property === 'role')).toBe(true);
  });
});
