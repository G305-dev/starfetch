import { ClamAvClient } from './clamav-client';

const runRealClamAv = process.env.INDIVIDUAL_KYC_CLAMAV_INTEGRATION === 'true';
const describeIfConfigured = runRealClamAv ? describe : describe.skip;

describeIfConfigured('real clamd EICAR integration (isolated synthetic bytes only)', () => {
  it('reports the EICAR test marker as infected and a synthetic PDF marker clean', async () => {
    const scanner = new ClamAvClient(process.env.INDIVIDUAL_KYC_CLAMD_HOST ?? '127.0.0.1', Number(process.env.INDIVIDUAL_KYC_CLAMD_PORT ?? 3310));
    const version = await scanner.version();
    expect(version).toMatch(/^ClamAV-/);
    const clean = await scanner.scan(Buffer.from('%PDF-1.7 synthetic fixture only'));
    expect(clean).toMatchObject({ clean: true, scannerVersion: version });
    const eicar = Buffer.concat([
      Buffer.from('%PDF-1.7\n'),
      Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'),
    ]);
    const infected = await scanner.scan(eicar);
    expect(infected).toMatchObject({ clean: false, scannerVersion: version });
  });
});
