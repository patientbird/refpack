/* Popup script — button handlers for refpack browser extension */

// ─── DOM References ──────────────────────────────────────────────────────────

const btnCopy = document.getElementById('btn-copy');
const btnSavePage = document.getElementById('btn-save-page');
const btnSaveGroup = document.getElementById('btn-save-group');
const btnLlmsCopy = document.getElementById('btn-llms-copy');
const btnLlmsSave = document.getElementById('btn-llms-save');
const groupCount = document.getElementById('group-count');
const llmsDot = document.getElementById('llms-dot');
const llmsSection = document.getElementById('llms-section');
const statusEl = document.getElementById('status');

// ─── State ───────────────────────────────────────────────────────────────────

let currentTab = null;
let discoveredUrls = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function showStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? 'status error' : 'status';
  statusEl.hidden = false;
  setTimeout(() => { statusEl.hidden = true; }, 3000);
}

function flashButton(btn, text) {
  const original = btn.textContent;
  btn.textContent = text;
  btn.classList.add('success');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('success');
  }, 1500);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function sendMessage(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

// Get a file handle immediately (must be called in user gesture context, before async work)
async function getFileHandle(suggestedName, mimeType, ext) {
  try {
    return await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: ext.toUpperCase() + ' file', accept: { [mimeType]: ['.' + ext] } }],
    });
  } catch (err) {
    if (err.name === 'AbortError') return null;
    return 'fallback';
  }
}

async function writeToHandle(handle, content, fallbackName) {
  if (handle === 'fallback' || !handle) {
    if (!handle) return; // user cancelled
    // Fallback: anchor download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

// ─── HTML-to-Markdown in popup context (port of CLI cleaner.js) ─────────────
// Used for group save — converts fetched HTML strings using DOMParser

const CONTENT_SELECTORS = [
  '.mdx-content', '.markdown-body', '[class*="prose"]', '.doc-content',
  '.content', '[role="main"]', 'main', 'article',
];

const REMOVE_SEL =
  'nav, header, footer, script, style, aside, noscript, svg, ' +
  '.sidebar, .menu, .navigation, .breadcrumb, .toc, [class*="sidebar"], ' +
  'button, [role="button"]';

function textOf(el) {
  return el.textContent.replace(/\s+/g, ' ').trim();
}

function inlineToMd(el) {
  const parts = [];
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      parts.push(child.data.replace(/\s+/g, ' '));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'code') parts.push('`' + child.textContent.trim() + '`');
      else if (tag === 'a') parts.push('[' + child.textContent.trim() + '](' + (child.getAttribute('href') || '') + ')');
      else if (tag === 'strong' || tag === 'b') parts.push('**' + child.textContent.trim() + '**');
      else if (tag === 'em' || tag === 'i') parts.push('*' + child.textContent.trim() + '*');
      else parts.push(child.textContent.replace(/\s+/g, ' '));
    }
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function cellTextOfPopup(el) {
  const parts = [];
  function extract(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.data.replace(/\s+/g, ' ').trim();
        if (t) parts.push(t);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName.toLowerCase() === 'img') {
          const alt = child.getAttribute('alt') || child.getAttribute('title') || '';
          if (alt) parts.push(alt);
        } else if (child.tagName.toLowerCase() !== 'br') {
          extract(child);
        }
      }
    }
  }
  extract(el);
  return parts.filter(p => !parts.some(o => o !== p && o.includes(p))).join(' ').trim();
}

function walkListPopup(listEl, lines, depth) {
  const tag = listEl.tagName.toLowerCase();
  const indent = '  '.repeat(depth);
  let idx = 0;
  for (const child of listEl.children) {
    if (child.tagName.toLowerCase() === 'li') {
      idx++;
      const prefix = tag === 'ol' ? idx + '. ' : '- ';
      const textParts = [];
      for (const c of child.childNodes) {
        if (c.nodeType === Node.ELEMENT_NODE && (c.tagName.toLowerCase() === 'ul' || c.tagName.toLowerCase() === 'ol')) continue;
        textParts.push(c.textContent);
      }
      const liText = textParts.join('').replace(/\s+/g, ' ').trim();
      if (liText) lines.push(indent + prefix + liText);
      for (const nested of child.children) {
        const nTag = nested.tagName.toLowerCase();
        if (nTag === 'ul' || nTag === 'ol') walkListPopup(nested, lines, depth + 1);
      }
    }
  }
}

function domToMarkdown(root) {
  const lines = [];
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.data.replace(/\s+/g, ' ');
      if (text.trim()) lines.push(text.trim());
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) { lines.push('\n' + '#'.repeat(+tag[1]) + ' ' + textOf(node) + '\n'); return; }
    if (tag === 'p' || tag === 'span') { lines.push('\n' + inlineToMd(node) + '\n'); return; }
    if (tag === 'pre') {
      const codeEl = node.querySelector('code');
      lines.push('\n```\n' + (codeEl ? codeEl.textContent : node.textContent).trimEnd() + '\n```\n');
      return;
    }
    if (tag === 'code' && node.parentElement && node.parentElement.tagName.toLowerCase() !== 'pre') {
      lines.push('`' + textOf(node) + '`'); return;
    }
    if (tag === 'a') { lines.push('[' + textOf(node) + '](' + (node.getAttribute('href') || '') + ')'); return; }
    if (tag === 'ul' || tag === 'ol') { walkListPopup(node, lines, 0); lines.push(''); return; }
    if (tag === 'table') {
      node.querySelectorAll('tr').forEach((row, i) => {
        const cellTexts = [];
        row.querySelectorAll('th, td').forEach(cell => {
          const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
          const cls = cell.getAttribute('class') || '';
          const isInactive = /\b(blank|inactive|disabled)\b/.test(cls);
          cellTexts.push(isInactive ? '' : cellTextOfPopup(cell));
          for (let c = 1; c < colspan; c++) cellTexts.push('');
        });
        lines.push('| ' + cellTexts.join(' | ') + ' |');
        if (i === 0) lines.push('| ' + cellTexts.map(() => '---').join(' | ') + ' |');
      });
      lines.push('');
      return;
    }
    for (const child of node.childNodes) walk(child);
  }
  for (const child of root.childNodes) walk(child);
  return lines.join('\n');
}

function convertHtmlString(html, sourceUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(REMOVE_SEL).forEach(el => el.remove());
  doc.querySelectorAll('div, span').forEach(el => {
    let ownText = '';
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) ownText += child.data;
    }
    if (ownText.trim() === 'Copy' || ownText.trim() === 'Copy page' || ownText.trim() === 'Copied!') el.remove();
  });
  doc.querySelectorAll('pre code div').forEach(div => {
    const text = document.createTextNode(div.textContent + '\n');
    div.replaceWith(text);
  });
  let root = null;
  for (const sel of CONTENT_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.trim().length > 50) { root = el; break; }
  }
  if (!root) root = doc.body;
  let md = domToMarkdown(root);
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  md = md.replace(/^(\[.*?\]\(.*?\)\s*\n)+/, '');
  return { markdown: md.trim(), title: doc.title || sourceUrl };
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  // Check llms.txt
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
  } catch { llmsSection.classList.add('unavailable'); }

  // Discover group pages (sitemap + crawl, like CLI)
  try {
    const resp = await sendMessage({ action: 'discoverPages', baseUrl: tab.url });
    if (resp && resp.urls && resp.urls.length > 0) {
      discoveredUrls = resp.urls;
      groupCount.textContent = '(' + discoveredUrls.length + ')';
    }
  } catch { /* silent */ }
}

// ─── Button Handlers ─────────────────────────────────────────────────────────

btnCopy.addEventListener('click', async () => {
  btnCopy.disabled = true;
  try {
    const resp = await sendMessage({ action: 'injectAndConvert', tabId: currentTab.id });
    if (resp && resp.error) { showStatus(resp.error, true); return; }
    await navigator.clipboard.writeText(resp.markdown);
    flashButton(btnCopy, 'Copied!');
  } finally { btnCopy.disabled = false; }
});

btnSavePage.addEventListener('click', async () => {
  // Get file handle FIRST while user gesture is active
  const title = currentTab.title || 'page';
  const filename = slugify(title) + '.md';
  const handle = await getFileHandle(filename, 'text/markdown', 'md');
  if (!handle) return; // user cancelled

  btnSavePage.disabled = true;
  try {
    const resp = await sendMessage({ action: 'injectAndConvert', tabId: currentTab.id });
    if (resp && resp.error) { showStatus(resp.error, true); return; }
    await writeToHandle(handle, resp.markdown, filename);
    flashButton(btnSavePage, 'Saved!');
  } finally { btnSavePage.disabled = false; }
});

btnSaveGroup.addEventListener('click', async () => {
  if (discoveredUrls.length === 0) {
    showStatus('No related pages found', true);
    return;
  }

  // Get file handle FIRST while user gesture is active
  const parsedUrl = new URL(currentTab.url);
  const domain = parsedUrl.hostname.replace('www.', '');
  const firstSeg = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
  const filenameBase = firstSeg ? domain + '-' + firstSeg : domain;
  const filename = slugify(filenameBase) + '.md';
  const handle = await getFileHandle(filename, 'text/markdown', 'md');
  if (!handle) return; // user cancelled

  const originalText = btnSaveGroup.textContent;
  btnSaveGroup.disabled = true;
  btnSaveGroup.textContent = 'Saving ' + discoveredUrls.length + ' pages...';

  try {
    const resp = await sendMessage({ action: 'fetchPages', urls: discoveredUrls });
    if (!resp || !resp.results) { showStatus('Failed to fetch pages', true); return; }

    const sections = [];
    let failCount = 0;

    for (const result of resp.results) {
      if (result.error) { failCount++; continue; }
      try {
        const converted = convertHtmlString(result.html, result.url);
        sections.push('# ' + converted.title + '\n\n> Source: ' + result.url + '\n\n' + converted.markdown);
      } catch { failCount++; }
    }

    if (sections.length === 0) { showStatus('Failed to convert any pages', true); return; }

    const bundled = sections.join('\n\n---\n\n');
    await writeToHandle(handle, bundled, filename);

    if (failCount > 0) {
      showStatus('Saved ' + sections.length + ' of ' + resp.results.length + ' pages');
    } else {
      flashButton(btnSaveGroup, 'Saved!');
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
    if (resp && resp.error) { showStatus('Failed to fetch llms.txt', true); return; }
    await navigator.clipboard.writeText(resp.content);
    flashButton(btnLlmsCopy, 'Copied!');
  } finally { btnLlmsCopy.disabled = false; }
});

btnLlmsSave.addEventListener('click', async () => {
  // Get file handle FIRST while user gesture is active
  const domain = new URL(currentTab.url).hostname.replace('www.', '');
  const filename = domain + '-llms.txt';
  const handle = await getFileHandle(filename, 'text/plain', 'txt');
  if (!handle) return;

  btnLlmsSave.disabled = true;
  try {
    const origin = new URL(currentTab.url).origin;
    const resp = await sendMessage({ action: 'fetchLlmsTxt', origin });
    if (resp && resp.error) { showStatus('Failed to fetch llms.txt', true); return; }
    await writeToHandle(handle, resp.content, filename);
    flashButton(btnLlmsSave, 'Saved!');
  } finally { btnLlmsSave.disabled = false; }
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

init();
