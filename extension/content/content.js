// Content script: converts web page content to markdown
// TurndownService is available as a global — injected alongside this script by the service worker.

const CONTENT_SELECTORS = [
  '.mdx-content',
  '.markdown-body',
  '[class*="prose"]',
  '.doc-content',
  '.content',
  '[role="main"]',
  'main',
  'article',
];

const REMOVE_SELECTORS =
  'nav, header, footer, script, style, aside, noscript, svg, .sidebar, .menu, .navigation, .breadcrumb, .toc, [class*="sidebar"], button, [role="button"]';

function findContentRoot() {
  for (const selector of CONTENT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim().length > 50) {
      return el;
    }
  }
  return document.body;
}

function cleanDom(root) {
  const clone = root.cloneNode(true);

  clone.querySelectorAll(REMOVE_SELECTORS).forEach((el) => el.remove());

  clone.querySelectorAll('div, span').forEach((el) => {
    const text = el.textContent.trim();
    if (text === 'Copy' || text === 'Copy page' || text === 'Copied!') {
      el.remove();
    }
  });

  return clone;
}

function getPageGroupLinks() {
  const currentUrl = new URL(window.location.href);
  const pathParts = currentUrl.pathname.split('/').filter(Boolean);
  pathParts.pop();
  const prefix = pathParts.length > 0 ? '/' + pathParts.join('/') + '/' : '/';

  const seen = new Set();
  const links = [];

  document.querySelectorAll('a[href]').forEach((a) => {
    try {
      const linkUrl = new URL(a.href, window.location.href);

      if (linkUrl.origin !== currentUrl.origin) return;
      if (!linkUrl.pathname.startsWith(prefix)) return;

      const normalized = linkUrl.origin + linkUrl.pathname.replace(/\/$/, '');

      if (!seen.has(normalized)) {
        seen.add(normalized);
        links.push({ url: normalized, text: a.textContent.trim() });
      }
    } catch {
      // skip malformed hrefs
    }
  });

  links.sort((a, b) => a.url.localeCompare(b.url));
  return links;
}

function convertToMarkdown() {
  const root = findContentRoot();
  const cleaned = cleanDom(root);

  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  let markdown = service.turndown(cleaned);

  // Normalize excessive blank lines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace
  markdown = markdown.trim();

  // Strip leading breadcrumb links (e.g. "[Home](/) \n [Docs](/docs) \n")
  markdown = markdown.replace(/^(\[.*?\]\(.*?\)\s*\n)+/, '');

  return markdown;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'convert') {
    try {
      const markdown = convertToMarkdown();
      sendResponse({
        markdown,
        title: document.title,
        url: window.location.href,
      });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  } else if (message.action === 'getGroupLinks') {
    try {
      const links = getPageGroupLinks();
      sendResponse({ links });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  }

  // Keep message channel open for async sendResponse
  return true;
});
