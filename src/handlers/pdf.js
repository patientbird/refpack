import path from 'path';
import { normalizeMarkdown } from '../pipeline/cleaner.js';

export async function processPdf(buffer, filename) {
  const { default: pdfParse } = await import('pdf-parse');
  const data = await pdfParse(buffer);
  const markdown = normalizeMarkdown(data.text);
  const slug = path.basename(filename, path.extname(filename)).toLowerCase();
  return { markdown, slug, sourcePath: filename };
}
