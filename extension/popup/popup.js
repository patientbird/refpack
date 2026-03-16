// Popup script: wires up all button handlers for the refpack browser extension popup.

// ─── DOM References ───────────────────────────────────────────────────────────

const btnCopy = document.getElementById('btn-copy');
const btnSavePage = document.getElementById('btn-save-page');
const btnSaveGroup = document.getElementById('btn-save-group');
const btnLlmsCopy = document.getElementById('btn-llms-copy');
const btnLlmsSave = document.getElementById('btn-llms-save');
const groupCount = document.getElementById('group-count');
const llmsDot = document.getElementById('llms-dot');
const llmsSection = document.getElementById('llms-section');
const statusEl = document.getElementById('status');

// ─── State ────────────────────────────────────────────────────────────────────

let currentTab = null;
let groupLinks = [];

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Show a status message, auto-hiding after 3 seconds.
 * @param {string} text
 * @param {boolean} isError
 */
function showStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? 'status error' : 'status';
  statusEl.hidden = false;
  setTimeout(() => {
    statusEl.hidden = true;
  }, 3000);
}

/**
 * Flash a button with a success label, then restore original text.
 * @param {HTMLButtonElement} btn
 * @param {string} text
 */
function flashButton(btn, text = 'Done!') {
  const original = btn.textContent;
  btn.textContent = text;
  btn.classList.add('success');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('success');
  }, 1500);
}

/**
 * Convert a string to a URL-safe slug (max 60 chars).
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Trigger a file download via the Chrome downloads API.
 * @param {string} content
 * @param {string} filename
 */
function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
}

/**
 * Send a message to the background service worker.
 * @param {object} msg
 * @returns {Promise<any>}
 */
function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}

// ─── Content Selectors (mirrored from content.js) ─────────────────────────────

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

/**
 * Convert an HTML string to markdown using TurndownService.
 * @param {string} html
 * @param {string} sourceUrl
 * @returns {{ markdown: string, title: string }}
 */
function htmlToMarkdown(html, sourceUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Find content root using same selectors as content.js
  let root = null;
  for (const selector of CONTENT_SELECTORS) {
    const el = doc.querySelector(selector);
    if (el && el.textContent.trim().length > 50) {
      root = el;
      break;
    }
  }
  if (!root) root = doc.body;

  // Clone and clean
  const clone = root.cloneNode(true);
  clone.querySelectorAll(REMOVE_SELECTORS).forEach((el) => el.remove());
  clone.querySelectorAll('div, span').forEach((el) => {
    const text = el.textContent.trim();
    if (text === 'Copy' || text === 'Copy page' || text === 'Copied!') {
      el.remove();
    }
  });

  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  let markdown = service.turndown(clone);

  // Normalize excessive blank lines and trim
  markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

  return { markdown, title: doc.title || sourceUrl };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  // Check for llms.txt
  try {
    const origin = new URL(tab.url).origin;
    const resp = await sendMessage({ action: 'checkLlmsTxt', origin });
    if (resp && resp.found) {
      llmsDot.classList.add('found');
      btnLlmsCopy.disabled = false;
      btnLlmsSave.disabled = false;
    } else {
      llmsSection.classList.add('unavailable');
    }
  } catch (_e) {
    llmsSection.classList.add('unavailable');
  }

  // Get group links
  try {
    const resp = await sendMessage({ action: 'injectAndGetLinks', tabId: tab.id });
    if (resp && resp.links) {
      groupLinks = resp.links.slice(0, 50);
      if (groupLinks.length > 0) {
        groupCount.textContent = `(${groupLinks.length})`;
      }
    }
  } catch (_e) {
    // silent fail
  }
}

// ─── Button Handlers ──────────────────────────────────────────────────────────

btnCopy.addEventListener('click', async () => {
  btnCopy.disabled = true;
  try {
    const resp = await sendMessage({ action: 'injectAndConvert', tabId: currentTab.id });
    if (resp && resp.error) {
      showStatus(resp.error, true);
    } else {
      await navigator.clipboard.writeText(resp.markdown);
      flashButton(btnCopy, 'Copied!');
    }
  } finally {
    btnCopy.disabled = false;
  }
});

btnSavePage.addEventListener('click', async () => {
  btnSavePage.disabled = true;
  try {
    const resp = await sendMessage({ action: 'injectAndConvert', tabId: currentTab.id });
    if (resp && resp.error) {
      showStatus(resp.error, true);
    } else {
      const filename = slugify(resp.title || 'page') + '.md';
      downloadFile(resp.markdown, filename);
      flashButton(btnSavePage, 'Saved!');
    }
  } finally {
    btnSavePage.disabled = false;
  }
});

btnSaveGroup.addEventListener('click', async () => {
  if (groupLinks.length === 0) {
    showStatus('No related pages found', true);
    return;
  }

  const originalText = btnSaveGroup.textContent;
  btnSaveGroup.disabled = true;
  btnSaveGroup.textContent = `Saving ${groupLinks.length} pages...`;

  try {
    const urls = groupLinks.map((l) => l.url);
    const resp = await sendMessage({ action: 'fetchPages', urls });

    const sections = [];
    let failCount = 0;

    for (const result of resp.results) {
      if (result.error) {
        failCount++;
        continue;
      }
      const { markdown, title } = htmlToMarkdown(result.html, result.url);
      sections.push(`# ${title}\n\n> Source: ${result.url}\n\n${markdown}`);
    }

    const bundled = sections.join('\n\n---\n\n');

    // Generate filename from domain + first path segment
    const parsedUrl = new URL(currentTab.url);
    const domain = parsedUrl.hostname.replace('www.', '');
    const firstSegment = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
    const filenameBase = firstSegment ? `${domain}-${firstSegment}` : domain;
    const filename = slugify(filenameBase) + '.md';

    downloadFile(bundled, filename);

    if (failCount > 0 && failCount < resp.results.length) {
      showStatus(`Saved ${sections.length} pages (${failCount} failed)`);
    } else if (failCount === 0) {
      flashButton(btnSaveGroup, 'Saved!');
    } else {
      showStatus('All pages failed to load', true);
    }
  } finally {
    btnSaveGroup.textContent = originalText;
    btnSaveGroup.disabled = false;
  }
});

btnLlmsCopy.addEventListener('click', async () => {
  btnLlmsCopy.disabled = true;
  try {
    const origin = new URL(currentTab.url).origin;
    const resp = await sendMessage({ action: 'fetchLlmsTxt', origin });
    if (resp && resp.error) {
      showStatus(resp.error, true);
    } else {
      await navigator.clipboard.writeText(resp.content);
      flashButton(btnLlmsCopy, 'Copied!');
    }
  } finally {
    btnLlmsCopy.disabled = false;
  }
});

btnLlmsSave.addEventListener('click', async () => {
  btnLlmsSave.disabled = true;
  try {
    const origin = new URL(currentTab.url).origin;
    const resp = await sendMessage({ action: 'fetchLlmsTxt', origin });
    if (resp && resp.error) {
      showStatus(resp.error, true);
    } else {
      const domain = new URL(currentTab.url).hostname.replace('www.', '');
      downloadFile(resp.content, `${domain}-llms.txt`);
      flashButton(btnLlmsSave, 'Saved!');
    }
  } finally {
    btnLlmsSave.disabled = false;
  }
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

init();
