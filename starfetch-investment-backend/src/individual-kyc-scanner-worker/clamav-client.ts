import { connect, Socket } from 'net';
import { MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES } from '../modules/individual-kyc/individual-kyc-document-ports';

export interface ClamAvScanResult {
  readonly clean: boolean;
  readonly scannerVersion: string;
}

/** Minimal clamd INSTREAM client. It never writes document bytes to disk or logs them. */
export class ClamAvClient {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs = 90_000,
  ) {
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || timeoutMs < 1000 || timeoutMs > 180_000) {
      throw new Error('Invalid private clamd connection settings.');
    }
  }

  async version(): Promise<string> {
    const response = await this.exchange([Buffer.from('zVERSION\0')]);
    const match = /^ClamAV\s+([A-Za-z0-9._/-]{1,80})$/.exec(response.trim());
    if (!match) throw new Error('ClamAV version response was invalid.');
    const normalized = `ClamAV-${match[1].replace(/[^A-Za-z0-9._-]/g, '-')}`.slice(0, 64);
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(normalized)) throw new Error('ClamAV version response was invalid.');
    return normalized;
  }

  async scan(bytes: Buffer): Promise<ClamAvScanResult> {
    if (bytes.length < 1 || bytes.length > MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES) throw new Error('Document size is outside scanner limits.');
    const scannerVersion = await this.version();
    const chunks: Buffer[] = [Buffer.from('zINSTREAM\0')];
    const chunkSize = 64 * 1024;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
      const length = Buffer.alloc(4);
      length.writeUInt32BE(chunk.length);
      chunks.push(length, chunk);
    }
    chunks.push(Buffer.alloc(4));
    const response = await this.exchange(chunks);
    if (/\bFOUND\b/.test(response)) return { clean: false, scannerVersion };
    if (/\bOK\b/.test(response)) return { clean: true, scannerVersion };
    throw new Error('ClamAV returned neither a clean nor a malware result.');
  }

  private async exchange(chunks: readonly Buffer[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const socket: Socket = connect({ host: this.host, port: this.port });
      let settled = false;
      let received = Buffer.alloc(0);
      const finish = (error?: Error, result?: string) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (error) reject(error);
        else resolve(result ?? '');
      };
      socket.setTimeout(this.timeoutMs, () => finish(new Error('ClamAV timed out.')));
      socket.once('error', () => finish(new Error('ClamAV is unavailable.')));
      socket.once('connect', async () => {
        try {
          for (const chunk of chunks) await writeSocket(socket, chunk);
        } catch {
          finish(new Error('ClamAV request failed.'));
        }
      });
      socket.on('data', (data: Buffer) => {
        if (received.length + data.length > 4096) return finish(new Error('ClamAV response exceeded limit.'));
        received = Buffer.concat([received, data]);
        const terminator = received.indexOf(0);
        if (terminator >= 0) finish(undefined, received.subarray(0, terminator).toString('utf8'));
      });
      socket.once('end', () => {
        if (!settled) finish(new Error('ClamAV returned an incomplete response.'));
      });
    });
  }
}

function writeSocket(socket: Socket, bytes: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const accepted = socket.write(bytes, (error) => error ? reject(error) : resolve());
    if (!accepted) socket.once('drain', resolve);
  });
}
