import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateManifest, writeManifest } from '../../src/utils/manifest.js';

describe('manifest', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-test-'));
    const refsDir = path.join(tmpDir, 'refs');
    fs.mkdirSync(refsDir);
    fs.writeFileSync(path.join(refsDir, 'page-one.md'), '# Page One\n\nContent here.');
    fs.writeFileSync(path.join(refsDir, 'page-two.md'), '# Page Two\n\nMore content.');
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  it('generateManifest creates correct manifest object', () => {
    const manifest = generateManifest(tmpDir, 'test-pack');
    expect(manifest.name).toBe('test-pack');
    expect(manifest.files).toBe(2);
    expect(manifest.fileList).toContain('refs/page-one.md');
    expect(manifest.fileList).toContain('refs/page-two.md');
    expect(manifest.builtAt).toBeDefined();
    expect(manifest.version).toBe('1.0.0');
  });
  it('writeManifest writes refpack.json to disk', () => {
    const manifest = generateManifest(tmpDir, 'test-pack');
    writeManifest(tmpDir, manifest);
    const content = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'refpack.json'), 'utf-8')
    );
    expect(content.name).toBe('test-pack');
    expect(content.files).toBe(2);
  });
});
