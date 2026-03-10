import fs from 'fs';
import path from 'path';
import { readRecipe, writeRecipe, addSource } from '../utils/recipe.js';
import { discoverPages } from '../handlers/discover.js';
import { ask } from '../utils/prompt.js';

function detectSourceType(source, options) {
  if (options.sitemap) return 'sitemap';
  if (options.single) return 'url';
  if (source.startsWith('http://') || source.startsWith('https://')) return 'url';
  if (fs.existsSync(source)) {
    const stat = fs.statSync(source);
    if (stat.isDirectory()) return 'directory';
    if (path.extname(source).toLowerCase() === '.pdf') return 'pdf';
    return 'file';
  }
  return 'url';
}

export async function runAdd(packDir, source, options = {}) {
  const recipe = readRecipe(packDir);
  if (!recipe) {
    throw new Error('No refpack found in this directory. Run "refpack init" first.');
  }

  const type = detectSourceType(source, options);

  // Auto-discovery for URLs (unless --single or --sitemap)
  if (type === 'url' && !options.single && !options.sitemap) {
    await addWithDiscovery(packDir, recipe, source, options);
    return;
  }

  const updated = addSource(recipe, { type, value: source });
  writeRecipe(packDir, updated);
  console.log(`Added ${type} source: ${source}`);
}

async function addWithDiscovery(packDir, recipe, url, options) {
  const startTime = performance.now();
  console.log(`\nDiscovering pages at ${url}...`);
  const { urls, method } = await discoverPages(url);
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  // Keep discover timing in seconds since it's usually quick

  if (urls.length === 0) {
    // No pages found — just add the single URL
    const updated = addSource(recipe, { type: 'url', value: url });
    writeRecipe(packDir, updated);
    console.log(`No related pages found. Added single URL: ${url}`);
    return;
  }

  if (urls.length === 1) {
    // Only the page itself — add it directly
    const updated = addSource(recipe, { type: 'url', value: urls[0] });
    writeRecipe(packDir, updated);
    console.log(`Added url source: ${urls[0]}`);
    return;
  }

  // Multiple pages found — confirm with user
  console.log(`Found ${urls.length} pages via ${method} in ${elapsed}s\n`);

  // Show a preview (first 10 + count of remaining)
  const preview = urls.slice(0, 10);
  preview.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
  if (urls.length > 10) {
    console.log(`  ... and ${urls.length - 10} more`);
  }

  if (options.yes) {
    addAllUrls(packDir, recipe, urls);
    return;
  }

  console.log('');
  const answer = await ask(`Add all ${urls.length} pages? (Y/n/list): `);

  if (answer.toLowerCase() === 'list') {
    urls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
    const answer2 = await ask(`\nAdd all ${urls.length} pages? (Y/n): `);
    if (answer2 === '' || answer2.toLowerCase() === 'y') {
      addAllUrls(packDir, recipe, urls);
    } else {
      console.log('Cancelled.');
    }
  } else if (answer === '' || answer.toLowerCase() === 'y') {
    addAllUrls(packDir, recipe, urls);
  } else {
    console.log('Cancelled. Use --single to add just this URL.');
  }
}

function addAllUrls(packDir, recipe, urls) {
  let updated = recipe;
  for (const url of urls) {
    updated = addSource(updated, { type: 'url', value: url });
  }
  writeRecipe(packDir, updated);
  console.log(`\nAdded ${urls.length} url sources.`);
}
