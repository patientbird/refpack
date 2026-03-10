import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runList } from '../../src/commands/list.js';
import { writeRecipe } from '../../src/utils/recipe.js';

describe('list command', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  it('returns source list from recipe', () => {
    writeRecipe(tmpDir, {
      name: 'test-pack',
      sources: [
        { type: 'url', value: 'https://example.com' },
        { type: 'pdf', value: './guide.pdf' },
      ],
    });
    const result = runList(tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('url');
    expect(result[1].type).toBe('pdf');
  });
  it('returns empty array for pack with no sources', () => {
    writeRecipe(tmpDir, { name: 'test-pack', sources: [] });
    const result = runList(tmpDir);
    expect(result).toHaveLength(0);
  });
  it('throws if no recipe.json exists', () => {
    expect(() => runList(tmpDir)).toThrow('No refpack found');
  });
});
