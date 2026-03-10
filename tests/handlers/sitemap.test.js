import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSitemap } from '../../src/handlers/sitemap.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '..', 'fixtures');

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

describe('parseSitemap', () => {
  it('parses sitemap XML and returns list of URLs', async () => {
    const xml = fs.readFileSync(path.join(fixturesDir, 'sample-sitemap.xml'), 'utf-8');
    const { default: fetch } = await import('node-fetch');
    fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(xml),
    });
    const urls = await parseSitemap('https://example.com/sitemap.xml');
    expect(urls).toHaveLength(3);
    expect(urls).toContain('https://example.com/docs/getting-started');
    expect(urls).toContain('https://example.com/docs/api-reference');
    expect(urls).toContain('https://example.com/docs/faq');
  });
  it('throws on non-OK response', async () => {
    const { default: fetch } = await import('node-fetch');
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(parseSitemap('https://example.com/sitemap.xml')).rejects.toThrow('500');
  });
});
