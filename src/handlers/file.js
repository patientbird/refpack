import fs from 'fs';
import path from 'path';
import { normalizeMarkdown } from '../pipeline/cleaner.js';

export function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const markdown = normalizeMarkdown(content);
  const slug = path.basename(filePath, path.extname(filePath)).toLowerCase();
  return { markdown, slug, sourcePath: filePath };
}

export function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.md' || ext === '.txt';
  });
  return files.map((f) => processFile(path.join(dirPath, f)));
}
