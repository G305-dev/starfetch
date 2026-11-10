import { Injectable } from '@nestjs/common';
import { MonoHttpResponse, MonoHttpTransport } from './mono-verification-ports';

@Injectable()
export class FetchMonoHttpTransport implements MonoHttpTransport {
  async post(
    url: string,
    headers: Readonly<Record<string, string>>,
    body: unknown,
    timeoutMs: number,
  ): Promise<MonoHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let parsed: unknown = null;
      try {
        parsed = await response.json();
      } catch {
        // An invalid/empty provider response is returned as `null` and handled
        // as a safe UNAVAILABLE result by the adapter.
      }
      return { status: response.status, body: parsed };
    } finally {
      clearTimeout(timeout);
    }
  }
}
