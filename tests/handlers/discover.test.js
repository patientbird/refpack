import { describe, it, expect, vi } from 'vitest';
import { discoverPages } from '../../src/handlers/discover.js';

vi.mock('node-fetch', () => ({
  default: vi.fn().mockImplementation((url) => {
    if (url.endsWith('/sitemap.xml')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(`<?xml version="1.0"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/docs/getting-started</loc></url>
            <url><loc>https://example.com/docs/api</loc></url>
            <url><loc>https://example.com/docs/faq</loc></url>
            <url><loc>https://example.com/blog/post-1</loc></url>
          </urlset>`),
      });
    }
    return Promise.resolve({ ok: false });
  }),
}));

describe('discoverPages', () => {
  it('discovers pages from sitemap filtered by path', async () => {
    const result = await discoverPages('https://example.com/docs');
    expect(result.method).toBe('sitemap');
    expect(result.urls).toHaveLength(3);
    expect(result.urls.every(u => u.includes('/docs/'))).toBe(true);
    expect(result.urls.some(u => u.includes('/blog/'))).toBe(false);
  });

  it('returns all sitemap URLs when given root domain', async () => {
    const result = await discoverPages('https://example.com');
    expect(result.method).toBe('sitemap');
    expect(result.urls).toHaveLength(4);
  });
});
