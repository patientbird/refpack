import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseSitemap } from './sitemap.js';

const USER_AGENT = 'refpack/0.1.0';
const CRAWL_DELAY_MS = 100;

/**
 * Discover all pages under a given URL.
 * Strategy:
 *   1. Try sitemap.xml at the domain root → filter to URLs under the given path
 *   2. If no sitemap (or empty), crawl internal links from the page
 */
export async function discoverPages(baseUrl) {
  const parsed = new URL(baseUrl);
  const origin = parsed.origin;
  const basePath = parsed.pathname.replace(/\/$/, '');

  // 1. Try sitemap
  const sitemapUrls = await trySitemap(origin, basePath);
  if (sitemapUrls.length > 0) {
    return { urls: sitemapUrls, method: 'sitemap' };
  }

  // 2. Fall back to link crawling
  const crawledUrls = await crawlLinks(baseUrl, origin, basePath);
  return { urls: crawledUrls, method: 'crawl' };
}

async function trySitemap(origin, basePath) {
  const sitemapUrl = `${origin}/sitemap.xml`;
  try {
    const urls = await parseSitemap(sitemapUrl);
    // Filter to URLs under the base path
    if (basePath && basePath !== '') {
      return urls.filter(u => {
        try {
          const p = new URL(u).pathname;
          return p.startsWith(basePath + '/') || p === basePath;
        } catch { return false; }
      });
    }
    return urls;
  } catch {
    return [];
  }
}

async function crawlLinks(startUrl, origin, basePath, maxDepth = 2) {
  const visited = new Set();
  const found = new Set();
  const queue = [{ url: normalizeUrl(startUrl), depth: 0 }];

  while (queue.length > 0) {
    const { url, depth } = queue.shift();
    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);
    found.add(url);

    if (depth >= maxDepth) continue;

    try {
      if (visited.size > 1) await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
      const response = await fetch(url, {
        timeout: 10000,
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!response.ok) continue;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;

      const html = await response.text();
      const $ = cheerio.load(html);
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        const resolved = resolveLink(href, origin, url);
        if (resolved && isUnderPath(resolved, origin, basePath) && !visited.has(resolved)) {
          queue.push({ url: resolved, depth: depth + 1 });
        }
      });
    } catch {
      // Skip unreachable pages
    }
  }

  return [...found].sort();
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    // Remove trailing slash, hash, and common tracking params
    u.hash = '';
    u.search = '';
    let path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.origin}${path}`;
  } catch { return url; }
}

function resolveLink(href, origin, currentUrl) {
  if (!href) return null;
  // Skip non-page links
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return null;
  try {
    const resolved = new URL(href, currentUrl);
    // Only follow same-origin links
    if (resolved.origin !== origin) return null;
    return normalizeUrl(resolved.href);
  } catch { return null; }
}

function isUnderPath(url, origin, basePath) {
  try {
    const u = new URL(url);
    if (u.origin !== origin) return false;
    if (!basePath || basePath === '') return true;
    return u.pathname.startsWith(basePath + '/') || u.pathname === basePath;
  } catch { return false; }
}
