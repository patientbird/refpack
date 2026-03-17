/* Service worker — llms.txt detection, badge, page discovery, message routing */

const USER_AGENT = 'refpack/0.1.0';
const CRAWL_DELAY_MS = 100;

// ─── llms.txt Detection ──────────────────────────────────────────────────────

async function checkLlmsTxt(origin) {
  try {
    const cacheKey = 'llms:' + origin;
    const cached = await chrome.storage.session.get(cacheKey);
    if (cacheKey in cached) return cached[cacheKey];

    let found = false;
    try {
      const resp = await fetch(origin + '/llms.txt', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      const contentType = resp.headers.get('content-type') || '';
      found = resp.ok && contentType.includes('text');
    } catch { found = false; }

    await chrome.storage.session.set({ [cacheKey]: found });
    return found;
  } catch { return false; }
}

function updateBadge(tabId, found) {
  if (found) {
    chrome.action.setBadgeText({ text: '\u25CF', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

// ─── Page Discovery (port of CLI discover.js) ───────────────────────────────

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    let path = u.pathname.replace(/\/+$/, '') || '/';
    return u.origin + path;
  } catch { return url; }
}

function resolveLink(href, origin, currentUrl) {
  if (!href) return null;
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return null;
  try {
    const resolved = new URL(href, currentUrl);
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

async function parseSitemap(sitemapUrl) {
  const resp = await fetch(sitemapUrl, {
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!resp.ok) throw new Error('Sitemap fetch failed: ' + resp.status);
  const xml = await resp.text();
  const urls = [];
  const locRegex = /<loc>\s*([\s\S]*?)\s*<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

async function trySitemap(origin, basePath) {
  try {
    const urls = await parseSitemap(origin + '/sitemap.xml');
    if (basePath && basePath !== '') {
      return urls.filter(u => {
        try {
          const p = new URL(u).pathname;
          return p.startsWith(basePath + '/') || p === basePath;
        } catch { return false; }
      });
    }
    return urls;
  } catch { return []; }
}

async function crawlLinks(startUrl, origin, basePath, maxDepth) {
  const visited = new Set();
  const found = new Set();
  const queue = [{ url: normalizeUrl(startUrl), depth: 0 }];

  while (queue.length > 0) {
    const item = queue.shift();
    const url = item.url;
    const depth = item.depth;
    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);
    found.add(url);

    if (depth >= maxDepth) continue;

    try {
      if (visited.size > 1) await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!resp.ok) continue;
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;

      const html = await resp.text();
      // Parse links with regex (no DOMParser in service worker)
      const linkRegex = /href=["']([^"']+)["']/g;
      let m;
      while ((m = linkRegex.exec(html)) !== null) {
        const resolved = resolveLink(m[1], origin, url);
        if (resolved && isUnderPath(resolved, origin, basePath) && !visited.has(resolved)) {
          queue.push({ url: resolved, depth: depth + 1 });
        }
      }
    } catch { /* skip unreachable */ }
  }

  return [...found].sort();
}

async function discoverPages(baseUrl) {
  const parsed = new URL(baseUrl);
  const origin = parsed.origin;
  const basePath = parsed.pathname.replace(/\/$/, '');

  // 1. Try sitemap first
  const sitemapUrls = await trySitemap(origin, basePath);
  if (sitemapUrls.length > 0) {
    return { urls: sitemapUrls, method: 'sitemap' };
  }

  // 2. Fall back to link crawling (maxDepth 2, same as CLI)
  const crawledUrls = await crawlLinks(baseUrl, origin, basePath, 2);
  return { urls: crawledUrls, method: 'crawl' };
}

// ─── Tab Listeners ───────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  try {
    const origin = new URL(tab.url).origin;
    if (!origin.startsWith('http')) return;
    const found = await checkLlmsTxt(origin);
    updateBadge(tabId, found);
  } catch { /* skip */ }
});

chrome.tabs.onActivated.addListener(async (tabId_info) => {
  try {
    const tab = await chrome.tabs.get(tabId_info.tabId);
    if (!tab.url) return;
    const origin = new URL(tab.url).origin;
    if (!origin.startsWith('http')) return;
    const found = await checkLlmsTxt(origin);
    updateBadge(tabId_info.tabId, found);
  } catch { /* skip */ }
});

// ─── Message Handlers ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'checkLlmsTxt') {
    checkLlmsTxt(msg.origin).then(found => sendResponse({ found }));
    return true;
  }

  if (msg.action === 'fetchLlmsTxt') {
    (async () => {
      try {
        const resp = await fetch(msg.origin + '/llms.txt', { signal: AbortSignal.timeout(10000) });
        if (resp.ok) {
          sendResponse({ content: await resp.text() });
        } else {
          sendResponse({ error: 'HTTP ' + resp.status });
        }
      } catch (err) { sendResponse({ error: err.message }); }
    })();
    return true;
  }

  if (msg.action === 'injectAndConvert') {
    (async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: msg.tabId },
          files: ['content/content.js'],
        });
        const resp = await chrome.tabs.sendMessage(msg.tabId, { action: 'convert' });
        sendResponse(resp);
      } catch (err) {
        sendResponse({ error: 'Cannot access this page: ' + err.message });
      }
    })();
    return true;
  }

  if (msg.action === 'injectAndGetLinks') {
    (async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: msg.tabId },
          files: ['content/content.js'],
        });
        const resp = await chrome.tabs.sendMessage(msg.tabId, { action: 'getGroupLinks' });
        sendResponse(resp);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  if (msg.action === 'discoverPages') {
    discoverPages(msg.baseUrl)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (msg.action === 'fetchPages') {
    (async () => {
      const results = [];
      for (let i = 0; i < msg.urls.length; i++) {
        const url = msg.urls[i];
        try {
          const resp = await fetch(url, {
            signal: AbortSignal.timeout(15000),
            headers: { 'Accept': 'text/html', 'User-Agent': USER_AGENT },
          });
          const contentType = resp.headers.get('content-type') || '';
          if (resp.ok && contentType.includes('text/html')) {
            results.push({ url, html: await resp.text() });
          } else {
            results.push({ url, error: 'HTTP ' + resp.status });
          }
        } catch (err) {
          results.push({ url, error: err.message });
        }
        if (i < msg.urls.length - 1) {
          await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
        }
      }
      sendResponse({ results });
    })();
    return true;
  }
});
