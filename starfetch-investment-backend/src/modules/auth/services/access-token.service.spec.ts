import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { AccessTokenService } from './access-token.service';

const SECRET = 'unit-test-jwt-access-secret-0123456789abcdef0123456789ab';

function buildService(ttlSeconds = 900) {
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256' },
    verifyOptions: { algorithms: ['HS256'] },
  });
  const config = new ConfigService({ 'auth.accessTokenTtlSeconds': ttlSeconds });
  return { jwt, service: new AccessTokenService(jwt, config) };
}

const principal = { userId: randomUUID(), role: 'INVESTOR' as const, sessionId: randomUUID() };

describe('AccessTokenService (15-min HS256 JWT, minimal claims)', () => {
  it('signs a compact JWT with sub/role/sid and ~15-minute expiry', async () => {
    const { jwt, service } = buildService();
    const token = await service.sign(principal);
    expect(token.split('.')).toHaveLength(3);

    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'role', 'sid', 'sub']);
    expect(decoded.sub).toBe(principal.userId);
    expect(decoded.role).toBe('INVESTOR');
    expect(decoded.sid).toBe(principal.sessionId);
    const ttl = (decoded.exp as number) - (decoded.iat as number);
    expect(ttl).toBe(900);
  });

  it('verifies a valid token into a principal', async () => {
    const { service } = buildService();
    const token = await service.sign(principal);
    await expect(service.verify(token)).resolves.toEqual(principal);
  });

  it('rejects a tampered token', async () => {
    const { service } = buildService();
    const token = await service.sign(principal);
    await expect(service.verify(token.slice(0, -3) + 'abc')).rejects.toThrow();
  });

  it('rejects a token signed with another secret (invalid signature)', async () => {
    const { service } = buildService();
    const foreign = new JwtService({ secret: 'different-secret-altogether-0123456789' });
    const token = await foreign.signAsync({ sub: principal.userId, role: 'INVESTOR', sid: principal.sessionId });
    await expect(service.verify(token)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const { jwt, service } = buildService();
    // exp already in the past
    const expired = await jwt.signAsync(
      { sub: principal.userId, role: 'INVESTOR', sid: principal.sessionId },
      { expiresIn: -10 },
    );
    await expect(service.verify(expired)).rejects.toThrow();
  });

  it('rejects malformed claims (non-uuid sub)', async () => {
    const { jwt, service } = buildService();
    const bad = await jwt.signAsync({ sub: 'not-a-uuid', role: 'INVESTOR', sid: principal.sessionId });
    await expect(service.verify(bad)).rejects.toThrow();
  });

  it('rejects malformed claims (unknown role)', async () => {
    const { jwt, service } = buildService();
    const bad = await jwt.signAsync({ sub: principal.userId, role: 'SUPERUSER', sid: principal.sessionId });
    await expect(service.verify(bad)).rejects.toThrow();
  });
});
