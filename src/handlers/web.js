import fetch from 'node-fetch';
import { cleanHtml } from '../pipeline/cleaner.js';
import { slugify } from '../utils/slugify.js';

export async function fetchPage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const html = await response.text();
  const markdown = cleanHtml(html);
  const slug = slugify(url);
  return { markdown, slug, url };
}
