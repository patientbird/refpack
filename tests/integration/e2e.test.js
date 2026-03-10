import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runInit } from '../../src/commands/init.js';
import { runAdd } from '../../src/commands/add.js';
import { runBuild } from '../../src/commands/build.js';
import { runList } from '../../src/commands/list.js';
import { runRemove } from '../../src/commands/remove.js';

vi.mock('../../src/handlers/web.js', () => ({
  fetchPage: vi.fn().mockResolvedValue({
    markdown: '# API Reference\n\nEndpoints and authentication.',
    slug: 'api-reference',
    url: 'https://example.com/docs/api',
  }),
}));

vi.mock('../../src/handlers/sitemap.js', () => ({
  parseSitemap: vi.fn().mockResolvedValue([]),
}));

describe('refpack end-to-end', () => {
  let baseDir;
  let packDir;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-e2e-'));
    packDir = path.join(baseDir, 'my-docs');
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true });
  });

  it('full workflow: init → add → list → build → verify output', async () => {
    runInit(packDir, 'my-docs');
    expect(fs.existsSync(path.join(packDir, 'recipe.json'))).toBe(true);

    await runAdd(packDir, 'https://example.com/docs/api', { single: true });

    const localFile = path.join(baseDir, 'notes.md');
    fs.writeFileSync(localFile, '# My Notes\n\nImportant stuff.');
    await runAdd(packDir, localFile, {});

    const sources = runList(packDir);
    expect(sources).toHaveLength(2);

    await runBuild(packDir);

    expect(fs.existsSync(path.join(packDir, 'refs'))).toBe(true);
    expect(fs.existsSync(path.join(packDir, 'refpack.json'))).toBe(true);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(packDir, 'refpack.json'), 'utf-8')
    );
    expect(manifest.name).toBe('my-docs');
    expect(manifest.files).toBe(2);
    expect(manifest.sources).toBe(2);

    const refs = fs.readdirSync(path.join(packDir, 'refs'));
    expect(refs).toHaveLength(2);
    expect(refs.every((f) => f.endsWith('.md'))).toBe(true);

    runRemove(packDir, 'https://example.com/docs/api');
    const remaining = runList(packDir);
    expect(remaining).toHaveLength(1);
  });
});
