import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runRemove } from '../../src/commands/remove.js';
import { writeRecipe, readRecipe } from '../../src/utils/recipe.js';

describe('remove command', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-test-'));
    writeRecipe(tmpDir, {
      name: 'test-pack',
      sources: [
        { type: 'url', value: 'https://example.com' },
        { type: 'pdf', value: './guide.pdf' },
      ],
    });
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  it('removes a source by value', () => {
    runRemove(tmpDir, 'https://example.com');
    const recipe = readRecipe(tmpDir);
    expect(recipe.sources).toHaveLength(1);
    expect(recipe.sources[0].value).toBe('./guide.pdf');
  });
  it('warns if source not found', () => {
    expect(() => runRemove(tmpDir, 'https://nonexistent.com')).not.toThrow();
    const recipe = readRecipe(tmpDir);
    expect(recipe.sources).toHaveLength(2);
  });
  it('throws if no recipe.json exists', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-empty-'));
    expect(() => runRemove(emptyDir, 'anything')).toThrow('No refpack found');
    fs.rmSync(emptyDir, { recursive: true });
  });
});
