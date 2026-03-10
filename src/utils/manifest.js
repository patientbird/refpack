import fs from 'fs';
import path from 'path';

export function generateManifest(dir, name) {
  const refsDir = path.join(dir, 'refs');
  const files = fs.existsSync(refsDir)
    ? fs.readdirSync(refsDir).filter((f) => f.endsWith('.md'))
    : [];
  const totalBytes = files.reduce((sum, f) => {
    return sum + fs.statSync(path.join(refsDir, f)).size;
  }, 0);
  const totalSize =
    totalBytes < 1024
      ? `${totalBytes}B`
      : totalBytes < 1048576
        ? `${(totalBytes / 1024).toFixed(1)}KB`
        : `${(totalBytes / 1048576).toFixed(1)}MB`;
  return {
    name,
    version: '1.0.0',
    builtAt: new Date().toISOString(),
    sources: 0,
    files: files.length,
    totalSize,
    fileList: files.map((f) => `refs/${f}`),
  };
}

export function writeManifest(dir, manifest) {
  const filePath = path.join(dir, 'refpack.json');
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n');
}
