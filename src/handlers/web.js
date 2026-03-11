import fetch from 'node-fetch';
import { cleanHtml } from '../pipeline/cleaner.js';
import { slugify } from '../utils/slugify.js';

const FETCH_TIMEOUT = 30000;
const USER_AGENT = 'refpack/0.1.0';
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10MB

export async function fetchPage(url) {
  const response = await fetch(url, {
    timeout: FETCH_TIMEOUT,
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error(`Skipping ${url}: not HTML (${contentType})`);
  }
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new Error(`Skipping ${url}: response too large (${contentLength} bytes)`);
  }
  const html = await response.text();
  const markdown = cleanHtml(html);
  const slug = slugify(url);
  return { markdown, slug, url };
}
