import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runAdd } from '../../src/commands/add.js';
import { writeRecipe, readRecipe } from '../../src/utils/recipe.js';

describe('add command', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-test-'));
    writeRecipe(tmpDir, { name: 'test-pack', sources: [] });
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  it('adds a URL source with --single flag', async () => {
    await runAdd(tmpDir, 'https://example.com/docs', { single: true });
    const recipe = readRecipe(tmpDir);
    expect(recipe.sources).toHaveLength(1);
    expect(recipe.sources[0]).toEqual({ type: 'url', value: 'https://example.com/docs' });
  });
  it('adds a sitemap source with --sitemap flag', async () => {
    await runAdd(tmpDir, 'https://example.com/sitemap.xml', { sitemap: true });
    const recipe = readRecipe(tmpDir);
    expect(recipe.sources[0].type).toBe('sitemap');
  });
  it('adds a local file source', async () => {
    const filePath = path.join(tmpDir, 'notes.md');
    fs.writeFileSync(filePath, '# Notes');
    await runAdd(tmpDir, filePath, {});
    const recipe = readRecipe(tmpDir);
    expect(recipe.sources[0].type).toBe('file');
  });
  it('adds a local directory source', async () => {
    const subDir = path.join(tmpDir, 'my-docs');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'a.md'), '# A');
    await runAdd(tmpDir, subDir, {});
    const recipe = readRecipe(tmpDir);
    expect(recipe.sources[0].type).toBe('directory');
  });
  it('detects PDF files', async () => {
    const pdfPath = path.join(tmpDir, 'guide.pdf');
    fs.writeFileSync(pdfPath, 'fake pdf');
    await runAdd(tmpDir, pdfPath, {});
    const recipe = readRecipe(tmpDir);
    expect(recipe.sources[0].type).toBe('pdf');
  });
  it('throws if no recipe.json exists', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-empty-'));
    await expect(runAdd(emptyDir, 'https://example.com', { single: true })).rejects.toThrow('No refpack found');
    fs.rmSync(emptyDir, { recursive: true });
  });
});
