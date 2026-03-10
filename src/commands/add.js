import fs from 'fs';
import path from 'path';
import { readRecipe, writeRecipe, addSource } from '../utils/recipe.js';

function detectSourceType(source, options) {
  if (options.sitemap) return 'sitemap';
  if (source.startsWith('http://') || source.startsWith('https://')) return 'url';
  if (fs.existsSync(source)) {
    const stat = fs.statSync(source);
    if (stat.isDirectory()) return 'directory';
    if (path.extname(source).toLowerCase() === '.pdf') return 'pdf';
    return 'file';
  }
  return 'url';
}

export function runAdd(packDir, source, options) {
  const recipe = readRecipe(packDir);
  if (!recipe) {
    throw new Error('No refpack found in this directory. Run "refpack init" first.');
  }
  const type = detectSourceType(source, options);
  const updated = addSource(recipe, { type, value: source });
  writeRecipe(packDir, updated);
  console.log(`Added ${type} source: ${source}`);
}
