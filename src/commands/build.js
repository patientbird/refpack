import fs from 'fs';
import { readRecipe } from '../utils/recipe.js';
import { generateManifest, writeManifest } from '../utils/manifest.js';
import { fetchPage } from '../handlers/web.js';
import { parseSitemap } from '../handlers/sitemap.js';
import { processFile, processDirectory } from '../handlers/file.js';
import { processPdf } from '../handlers/pdf.js';
import { writeRefs } from '../pipeline/writer.js';

const CONCURRENCY = 10;
const FETCH_DELAY_MS = 100;

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBatch(urls, prefix = '  ') {
  const results = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    if (i > 0) await delay(FETCH_DELAY_MS);
    const batch = urls.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (url) => {
      console.log(`${prefix}Fetching ${url}...`);
      try {
        return await fetchPage(url);
      } catch (err) {
        console.error(`${prefix}Error fetching ${url}: ${err.message}`);
        return null;
      }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
  }
  return results;
}

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

  // Collect all URLs to fetch, process local sources immediately
  const urlsToFetch = [];
  const docs = [];

  for (const source of recipe.sources) {
    try {
      switch (source.type) {
        case 'url':
          urlsToFetch.push(source.value);
          break;
        case 'sitemap': {
          console.log(`  Parsing sitemap ${source.value}...`);
          const urls = await parseSitemap(source.value);
          console.log(`  Found ${urls.length} URLs in sitemap.`);
          urlsToFetch.push(...urls);
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

  // Fetch all URLs concurrently in batches
  if (urlsToFetch.length > 0) {
    console.log(`  Fetching ${urlsToFetch.length} pages (${CONCURRENCY} at a time)...\n`);
    const fetched = await fetchBatch(urlsToFetch, '    ');
    docs.push(...fetched);
  }

  if (docs.length === 0) {
    console.log('\nNo documents were successfully processed.');
    return;
  }
  writeRefs(packDir, docs);
  const manifest = generateManifest(packDir, recipe.name);
  manifest.sources = recipe.sources.length;
  writeManifest(packDir, manifest);
  console.log(`\nDone! ${docs.length} file(s) written to refs/ in ${formatTime(performance.now() - startTime)}`);
  console.log(`Manifest written to refpack.json`);
}
