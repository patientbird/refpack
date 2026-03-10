import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runBuild } from '../../src/commands/build.js';
import { writeRecipe } from '../../src/utils/recipe.js';

vi.mock('../../src/handlers/web.js', () => ({
  fetchPage: vi.fn().mockResolvedValue({
    markdown: '# Example Docs\n\nSome documentation content.',
    slug: 'example-docs',
    url: 'https://example.com/docs',
  }),
}));

vi.mock('../../src/handlers/sitemap.js', () => ({
  parseSitemap: vi.fn().mockResolvedValue([
    'https://example.com/docs/page-1',
    'https://example.com/docs/page-2',
  ]),
}));

describe('build command', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  it('builds a pack from URL sources', async () => {
    writeRecipe(tmpDir, {
      name: 'test-pack',
      sources: [{ type: 'url', value: 'https://example.com/docs' }],
    });
    await runBuild(tmpDir);
    const refsDir = path.join(tmpDir, 'refs');
    expect(fs.existsSync(refsDir)).toBe(true);
    const files = fs.readdirSync(refsDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/\.md$/);
    expect(fs.existsSync(path.join(tmpDir, 'refpack.json'))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'refpack.json'), 'utf-8'));
    expect(manifest.name).toBe('test-pack');
    expect(manifest.files).toBeGreaterThan(0);
  });
  it('builds a pack from local file sources', async () => {
    const mdFile = path.join(tmpDir, 'source.md');
    fs.writeFileSync(mdFile, '# Local Doc\n\nContent here.');
    writeRecipe(tmpDir, {
      name: 'test-pack',
      sources: [{ type: 'file', value: mdFile }],
    });
    await runBuild(tmpDir);
    const refsDir = path.join(tmpDir, 'refs');
    const files = fs.readdirSync(refsDir);
    expect(files).toHaveLength(1);
  });
  it('throws if no recipe.json exists', async () => {
    await expect(runBuild(tmpDir)).rejects.toThrow('No refpack found');
  });
  it('throws if recipe has no sources', async () => {
    writeRecipe(tmpDir, { name: 'test-pack', sources: [] });
    await expect(runBuild(tmpDir)).rejects.toThrow('No sources');
  });
});
