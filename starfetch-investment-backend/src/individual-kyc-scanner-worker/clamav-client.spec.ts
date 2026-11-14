import { createServer, Server } from 'net';
import { ClamAvClient } from './clamav-client';

async function mockClamd(): Promise<{ server: Server; client: ClamAvClient }> {
  const server = createServer((socket) => {
    let pending = Buffer.alloc(0);
    let command: 'VERSION' | 'INSTREAM' | null = null;
    let stream = Buffer.alloc(0);
    let answered = false;
    socket.on('data', (data) => {
      pending = Buffer.concat([pending, data]);
      if (command === null) {
        const terminator = pending.indexOf(0);
        if (terminator < 0) return;
        const prefix = pending.subarray(0, terminator).toString('ascii');
        pending = pending.subarray(terminator + 1);
        if (prefix === 'zVERSION') {
          command = 'VERSION';
          if (!answered) { answered = true; socket.end(Buffer.from('ClamAV 1.4.3/12345/Tue\0')); }
          return;
        }
        if (prefix !== 'zINSTREAM') { socket.destroy(); return; }
        command = 'INSTREAM';
      }
      if (command === 'INSTREAM' && !answered) {
        while (pending.length >= 4) {
          const length = pending.readUInt32BE(0);
          if (length === 0) {
            pending = pending.subarray(4);
            answered = true;
            const found = stream.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'));
            socket.end(Buffer.from(found ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0'));
            return;
          }
          if (pending.length < 4 + length) return;
          stream = Buffer.concat([stream, pending.subarray(4, 4 + length)]);
          pending = pending.subarray(4 + length);
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind test clamd.');
  return { server, client: new ClamAvClient('127.0.0.1', address.port, 3000) };
}

describe('ClamAV INSTREAM protocol adapter', () => {
  let server: Server | undefined;
  afterEach(async () => { if (server) await new Promise<void>((resolve) => server!.close(() => resolve())); server = undefined; });

  it('requests engine version and distinguishes synthetic EICAR from clean bytes', async () => {
    const fixture = await mockClamd(); server = fixture.server;
    expect(await fixture.client.version()).toMatch(/^ClamAV-/);
    expect(await fixture.client.scan(Buffer.from('%PDF-1.7 synthetic'))).toMatchObject({ clean: true });
    expect(await fixture.client.scan(Buffer.from('%PDF-1.7 EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))).toMatchObject({ clean: false });
  });

  it('fails closed when the scanner socket is unavailable', async () => {
    const fixture = await mockClamd(); server = fixture.server;
    const address = fixture.server.address() as { port: number };
    await new Promise<void>((resolve) => fixture.server.close(() => resolve()));
    server = undefined;
    await expect(new ClamAvClient('127.0.0.1', address.port, 1000).version()).rejects.toThrow();
  });
});
