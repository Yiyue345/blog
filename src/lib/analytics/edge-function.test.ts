import { describe, expect, it, vi } from 'vitest';
import { onRequestGet, onRequestPost } from '../../../edge-functions/api/analytics.js';

class MemoryBlob {
  values = new Map<string, string>();

  async get(key: string, options?: { type?: string; consistency?: string }) {
    const value = this.values.get(key) ?? null;
    if (value !== null && options?.type === 'json') {
      return JSON.parse(value);
    }
    return value;
  }

  async setJSON(key: string, value: unknown) {
    this.values.set(key, JSON.stringify(value));
  }

  async list({ prefix = '' }: { prefix?: string; consistency?: string } = {}) {
    const blobs = [...this.values.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort()
      .map((key) => ({ key, etag: `etag-${key}` }));
    return { blobs };
  }
}

function createContext(store: MemoryBlob, request: Request) {
  return { request, analyticsStore: store, params: {}, waitUntil: () => undefined };
}

function createVisitRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://blog.yiyuemeow.com/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('analytics edge function', () => {
  it('records site and article visits without storing visitor identity', async () => {
    const store = new MemoryBlob();
    const request = createVisitRequest({ path: '/blog/hello-world/', title: 'Hello World' });

    const response = await onRequestPost(createContext(store, request));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.site.totalVisits).toBe(1);
    expect(payload.article).toMatchObject({
      path: '/blog/hello-world/',
      title: 'Hello World',
      views: 1,
    });
    expect([...store.values.values()].join(' ')).not.toContain('user-agent');
  });

  it('counts non-article pages only in site totals', async () => {
    const store = new MemoryBlob();
    const response = await onRequestPost(createContext(store, createVisitRequest({ path: '/about/' })));
    const payload = await response.json();

    expect(payload.site.totalVisits).toBe(1);
    expect(payload.article).toBeNull();
    expect([...store.values.keys()].filter((key) => key.startsWith('analytics/articles/'))).toHaveLength(0);
  });

  it('does not treat blog pagination as an article when the client marks it as a page', async () => {
    const store = new MemoryBlob();
    const response = await onRequestPost(
      createContext(store, createVisitRequest({ path: '/blog/2/', type: 'page' })),
    );
    const payload = await response.json();

    expect(payload.site.totalVisits).toBe(1);
    expect(payload.article).toBeNull();
    expect([...store.values.keys()].filter((key) => key.startsWith('analytics/articles/'))).toHaveLength(0);
  });

  it('returns a limited popular article ranking', async () => {
    const store = new MemoryBlob();
    await onRequestPost(createContext(store, createVisitRequest({ path: '/blog/first/', title: 'First' })));
    await onRequestPost(createContext(store, createVisitRequest({ path: '/blog/second/', title: 'Second' })));
    await onRequestPost(createContext(store, createVisitRequest({ path: '/blog/second/', title: 'Second' })));

    const request = new Request('https://blog.yiyuemeow.com/api/analytics?limit=1');
    const response = await onRequestGet(createContext(store, request));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.site.totalVisits).toBe(3);
    expect(payload.popularArticles).toEqual([
      expect.objectContaining({ path: '/blog/second/', title: 'Second', views: 2 }),
    ]);
    expect(payload.meta).toMatchObject({ limit: 1, consistency: 'strong' });
  });

  it('rejects cross-origin writes and invalid payloads', async () => {
    const store = new MemoryBlob();
    const crossOrigin = await onRequestPost(
      createContext(
        store,
        createVisitRequest({ path: '/' }, { origin: 'https://example.com', 'sec-fetch-site': 'cross-site' }),
      ),
    );
    const invalidPath = await onRequestPost(
      createContext(store, createVisitRequest({ path: 'https://example.com/blog/fake/' })),
    );
    const invalidType = await onRequestPost(
      createContext(store, createVisitRequest({ path: '/about/', type: 'article' })),
    );

    expect(crossOrigin.status).toBe(403);
    expect(invalidPath.status).toBe(400);
    expect(invalidType.status).toBe(400);
    expect(store.values.size).toBe(0);
  });

  it('returns 503 when Blob storage is unavailable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const request = new Request('https://blog.yiyuemeow.com/api/analytics');
    const store = new MemoryBlob();
    vi.spyOn(store, 'get').mockRejectedValueOnce(new Error('Blob unavailable'));
    const response = await onRequestGet(createContext(store, request));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'ANALYTICS_UNAVAILABLE' } });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
