import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchPage } from '../../src/handlers/web.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '..', 'fixtures');

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

describe('fetchPage', () => {
  it('fetches a URL and returns clean markdown with metadata', async () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'sample.html'), 'utf-8');
    const { default: fetch } = await import('node-fetch');
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: (h) => h === 'content-type' ? 'text/html; charset=utf-8' : null },
      text: () => Promise.resolve(html),
    });
    const result = await fetchPage('https://example.com/docs/sponsored-products');
    expect(result.markdown).toContain('# Sponsored Products API');
    expect(result.markdown).toContain('Authentication');
    expect(result.slug).toBe('sponsored-products');
  });
  it('throws on non-OK response', async () => {
    const { default: fetch } = await import('node-fetch');
    fetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchPage('https://example.com/404')).rejects.toThrow('404');
  });
});
