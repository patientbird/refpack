import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runInit } from '../../src/commands/init.js';

describe('init command', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  it('creates a pack directory with recipe.json', () => {
    const packDir = path.join(tmpDir, 'my-pack');
    runInit(packDir, 'my-pack');
    expect(fs.existsSync(packDir)).toBe(true);
    const recipe = JSON.parse(fs.readFileSync(path.join(packDir, 'recipe.json'), 'utf-8'));
    expect(recipe.name).toBe('my-pack');
    expect(recipe.sources).toEqual([]);
  });
  it('throws if directory already exists', () => {
    const packDir = path.join(tmpDir, 'my-pack');
    fs.mkdirSync(packDir);
    expect(() => runInit(packDir, 'my-pack')).toThrow('already exists');
  });
});
