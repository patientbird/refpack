import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeRefs } from '../../src/pipeline/writer.js';

describe('writer', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  it('writes markdown files to refs/ directory', () => {
    const docs = [
      { markdown: '# Page One\n\nContent.', slug: 'page-one' },
      { markdown: '# Page Two\n\nMore content.', slug: 'page-two' },
    ];
    writeRefs(tmpDir, docs);
    const refsDir = path.join(tmpDir, 'refs');
    expect(fs.existsSync(refsDir)).toBe(true);
    expect(fs.readFileSync(path.join(refsDir, 'page-one.md'), 'utf-8')).toContain('# Page One');
    expect(fs.readFileSync(path.join(refsDir, 'page-two.md'), 'utf-8')).toContain('# Page Two');
  });
  it('handles duplicate slugs by appending a number', () => {
    const docs = [
      { markdown: '# First', slug: 'page' },
      { markdown: '# Second', slug: 'page' },
    ];
    writeRefs(tmpDir, docs);
    const refsDir = path.join(tmpDir, 'refs');
    expect(fs.existsSync(path.join(refsDir, 'page.md'))).toBe(true);
    expect(fs.existsSync(path.join(refsDir, 'page-2.md'))).toBe(true);
  });
});
