import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const FETCH_TIMEOUT = 30000;
const USER_AGENT = 'refpack/0.1.0';

export async function parseSitemap(sitemapUrl) {
  const response = await fetch(sitemapUrl, {
    timeout: FETCH_TIMEOUT,
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap ${sitemapUrl}: ${response.status}`);
  }
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = [];
  $('url > loc').each((_, el) => {
    urls.push($(el).text().trim());
  });
  return urls;
}
