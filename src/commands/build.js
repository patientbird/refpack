import fs from 'fs';
import { readRecipe } from '../utils/recipe.js';
import { generateManifest, writeManifest } from '../utils/manifest.js';
import { fetchPage } from '../handlers/web.js';
import { parseSitemap } from '../handlers/sitemap.js';
import { processFile, processDirectory } from '../handlers/file.js';
import { processPdf } from '../handlers/pdf.js';
import { writeRefs } from '../pipeline/writer.js';

export async function runBuild(packDir) {
  const recipe = readRecipe(packDir);
  if (!recipe) {
    throw new Error('No refpack found in this directory. Run "refpack init" first.');
  }
  if (recipe.sources.length === 0) {
    throw new Error('No sources added. Run "refpack add <source>" first.');
  }
  const startTime = performance.now();
  console.log(`Building "${recipe.name}" from ${recipe.sources.length} source(s)...\n`);
  const docs = [];
  for (const source of recipe.sources) {
    try {
      switch (source.type) {
        case 'url': {
          console.log(`  Fetching ${source.value}...`);
          const result = await fetchPage(source.value);
          docs.push(result);
          break;
        }
        case 'sitemap': {
          console.log(`  Parsing sitemap ${source.value}...`);
          const urls = await parseSitemap(source.value);
          console.log(`  Found ${urls.length} URLs in sitemap.`);
          for (const url of urls) {
            console.log(`    Fetching ${url}...`);
            const result = await fetchPage(url);
            docs.push(result);
          }
          break;
        }
        case 'file': {
          console.log(`  Processing file ${source.value}...`);
          const result = processFile(source.value);
          docs.push(result);
          break;
        }
        case 'directory': {
          console.log(`  Processing directory ${source.value}...`);
          const results = processDirectory(source.value);
          docs.push(...results);
          break;
        }
        case 'pdf': {
          console.log(`  Processing PDF ${source.value}...`);
          const buffer = fs.readFileSync(source.value);
          const result = await processPdf(buffer, source.value);
          docs.push(result);
          break;
        }
        default:
          console.warn(`  Unknown source type: ${source.type}, skipping.`);
      }
    } catch (err) {
      console.error(`  Error processing ${source.value}: ${err.message}`);
    }
  }
  if (docs.length === 0) {
    console.log('\nNo documents were successfully processed.');
    return;
  }
  writeRefs(packDir, docs);
  const manifest = generateManifest(packDir, recipe.name);
  manifest.sources = recipe.sources.length;
  writeManifest(packDir, manifest);
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone! ${docs.length} file(s) written to refs/ in ${elapsed}s`);
  console.log(`Manifest written to refpack.json`);
}
