import fs from 'fs';
import path from 'path';

export function writeRefs(dir, docs) {
  const refsDir = path.join(dir, 'refs');
  if (!fs.existsSync(refsDir)) {
    fs.mkdirSync(refsDir, { recursive: true });
  }
  const usedSlugs = new Map();
  for (const doc of docs) {
    let slug = doc.slug;
    const count = (usedSlugs.get(slug) || 0) + 1;
    usedSlugs.set(slug, count);
    if (count > 1) slug = `${slug}-${count}`;
    fs.writeFileSync(path.join(refsDir, `${slug}.md`), doc.markdown + '\n');
  }
}
