import { Injectable } from '@nestjs/common';
import { MonoLookupHttpResponse, MonoLookupHttpTransport } from './mono-lookup-ports';

@Injectable()
export class FetchMonoLookupHttpTransport implements MonoLookupHttpTransport {
  async get(url: string, headers: Readonly<Record<string, string>>, timeoutMs: number): Promise<MonoLookupHttpResponse> {
    return this.request(url, headers, timeoutMs);
  }

  async post(url: string, headers: Readonly<Record<string, string>>, body: unknown, timeoutMs: number): Promise<MonoLookupHttpResponse> {
    return this.request(url, headers, timeoutMs, body);
  }

  private async request(
    url: string,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    body?: unknown,
  ): Promise<MonoLookupHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      let parsed: unknown = null;
      try { parsed = await response.json(); } catch { /* Invalid response is treated as unavailable by the adapter. */ }
      return { status: response.status, body: parsed };
    } finally {
      clearTimeout(timeout);
    }
  }
}
