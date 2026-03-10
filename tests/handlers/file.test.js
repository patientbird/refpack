import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { processFile, processDirectory } from '../../src/handlers/file.js';

describe('file handler', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  it('processFile reads a markdown file and returns normalized content', () => {
    const filePath = path.join(tmpDir, 'test.md');
    fs.writeFileSync(filePath, '# Hello\n\n\n\nWorld\n');
    const result = processFile(filePath);
    expect(result.markdown).toBe('# Hello\n\nWorld');
    expect(result.slug).toBe('test');
  });
  it('processFile reads a .txt file', () => {
    const filePath = path.join(tmpDir, 'notes.txt');
    fs.writeFileSync(filePath, 'Some plain text notes.');
    const result = processFile(filePath);
    expect(result.markdown).toBe('Some plain text notes.');
    expect(result.slug).toBe('notes');
  });
  it('processDirectory returns all .md and .txt files', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.md'), '# A');
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'B');
    fs.writeFileSync(path.join(tmpDir, 'c.json'), '{}');
    const results = processDirectory(tmpDir);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.slug).sort()).toEqual(['a', 'b']);
  });
});
