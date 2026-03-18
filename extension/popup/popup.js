/* Popup script — button handlers for refpack browser extension */

// ─── DOM References ──────────────────────────────────────────────────────────

const btnCopy = document.getElementById('btn-copy');
const btnSavePage = document.getElementById('btn-save-page');
const btnSaveGroupMd = document.getElementById('btn-save-group-md');
const btnSaveGroupZip = document.getElementById('btn-save-group-zip');
const btnLlmsCopy = document.getElementById('btn-llms-copy');
const btnLlmsSave = document.getElementById('btn-llms-save');
const groupCount = document.getElementById('group-count');
const groupSection = document.getElementById('group-section');
const progressRow = document.getElementById('progress-row');
const progressBarWrap = document.getElementById('progress-bar-wrap');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const btnPause = document.getElementById('btn-pause');
const btnCancel = document.getElementById('btn-cancel');
const llmsDot = document.getElementById('llms-dot');
const llmsSection = document.getElementById('llms-section');
const statusEl = document.getElementById('status');

// ─── State ───────────────────────────────────────────────────────────────────

let currentTab = null;
let discoveredUrls = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function showStatus(text, type = 'info') {
  statusEl.textContent = text;
  statusEl.className = 'status' + (type === 'error' ? ' error' : type === 'warning' ? ' warning' : '');
  statusEl.hidden = false;
  setTimeout(() => { statusEl.hidden = true; }, 4000);
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

  // Check if there's an in-progress group fetch from a previous popup open
  resumeGroupProgress();

  // Discover group pages by extracting links directly from the page DOM
  groupCount.textContent = 'scanning...';
  btnSaveGroupMd.disabled = true;
  btnSaveGroupZip.disabled = true;
  try {
    const tabUrl = new URL(tab.url);
    const basePath = tabUrl.pathname.replace(/\/+$/, '') || '/';
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (basePath) => {
        const seen = new Set();
        const currentPath = location.pathname.replace(/\/+$/, '') || '/';
        const currentNorm = location.origin + currentPath;
        document.querySelectorAll('a[href]').forEach(a => {
          try {
            const u = new URL(a.href);
            if (u.origin !== location.origin) return;
            const p = u.pathname.replace(/\/+$/, '') || '/';
            if (!(p.startsWith(basePath + '/') || p === basePath)) return;
            const norm = u.origin + p;
            if (norm !== currentNorm) seen.add(norm);
          } catch {}
        });
        return [...seen].sort();
      },
      args: [basePath],
    });
    const links = results && results[0] && results[0].result;
    if (links && links.length > 0) {
      discoveredUrls = links;
      groupCount.textContent = links.length + ' pages';
      btnSaveGroupMd.disabled = false;
      btnSaveGroupZip.disabled = false;
    } else {
      groupCount.textContent = 'no related pages';
      groupSection.classList.add('unavailable');
    }
  } catch (err) {
    groupCount.textContent = 'scan failed';
    groupSection.classList.add('unavailable');
  }
}

// ─── Button Handlers ─────────────────────────────────────────────────────────

btnCopy.addEventListener('click', async () => {
  btnCopy.disabled = true;
  try {
    const resp = await sendMessage({ action: 'injectAndConvert', tabId: currentTab.id });
    if (resp && resp.error) { showStatus(resp.error, 'error'); return; }
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
    if (resp && resp.error) { showStatus(resp.error, 'error'); return; }
    await writeToHandle(handle, resp.markdown, filename);
    flashButton(btnSavePage, 'Saved!');
  } finally { btnSavePage.disabled = false; }
});

function groupFilenameBase() {
  const parsedUrl = new URL(currentTab.url);
  const domain = parsedUrl.hostname.replace('www.', '');
  const firstSeg = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
  return firstSeg ? domain + '-' + firstSeg : domain;
}

// Convert raw fetch results to markdown pages
function convertResults(results) {
  const pages = [];
  let failCount = 0;
  for (const r of results) {
    if (r.error) { failCount++; continue; }
    try {
      const converted = convertHtmlString(r.html, r.url);
      const urlPath = new URL(r.url).pathname.replace(/\/+$/, '');
      const slug = urlPath.split('/').filter(Boolean).pop() || 'index';
      pages.push({ title: converted.title, markdown: converted.markdown, url: r.url, slug });
    } catch { failCount++; }
  }
  return { pages, failCount, total: results.length };
}

// Build final .md or .zip content and trigger download. Returns true on success.
async function buildAndDownload(result, format, filename) {
  let blob;
  if (format === 'zip') {
    const zip = new JSZip();
    const usedNames = new Set();
    for (const page of result.pages) {
      let name = page.slug;
      if (usedNames.has(name)) {
        let i = 2;
        while (usedNames.has(name + '-' + i)) i++;
        name = name + '-' + i;
      }
      usedNames.add(name);
      zip.file(name + '.md', '# ' + page.title + '\n\n> Source: ' + page.url + '\n\n' + page.markdown);
    }
    blob = await zip.generateAsync({ type: 'blob' });
  } else {
    const sections = result.pages.map(p =>
      '# ' + p.title + '\n\n> Source: ' + p.url + '\n\n' + p.markdown
    );
    blob = new Blob([sections.join('\n\n---\n\n')], { type: 'text/markdown' });
  }

  const blobUrl = URL.createObjectURL(blob);
  try {
    const downloadId = await chrome.downloads.download({
      url: blobUrl, filename, saveAs: true,
    });
    if (!downloadId) throw new Error('Download failed to start');
    return true;
  } catch (err) {
    showStatus('Download failed: ' + err.message, 'error');
    sendMessage({ action: 'setIcon', color: 'red' });
    return false;
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }
}

// ── Group Save (service worker handles fetching, popup handles conversion) ──

let groupPort = null;
let activeGroupBtn = null;
let isPaused = false;
let groupCancelled = false; // prevents queued messages from updating UI after cancel

function setActiveBtn(format) {
  activeGroupBtn = format === 'zip' ? btnSaveGroupZip : btnSaveGroupMd;
}

function setButtonDot(btn, color, text) {
  btn.textContent = '';
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  dot.style.background = color;
  dot.style.boxShadow = '0 0 5px 1px ' + color;
  btn.appendChild(dot);
  btn.appendChild(document.createTextNode(text));
}

function showFetchingUI(done, total, paused) {
  btnSaveGroupMd.disabled = true;
  btnSaveGroupZip.disabled = true;
  progressRow.hidden = false;
  progressBarWrap.hidden = false;
  progressText.hidden = true;
  progressFill.style.width = Math.round((done / total) * 100) + '%';
  btnPause.hidden = false;
  btnCancel.textContent = '\u2715';
  btnCancel.className = 'btn-cancel';
  btnCancel.title = 'Cancel';

  groupCount.textContent = done + ' / ' + total;
  groupCount.className = 'count-badge ' + (paused ? 'paused' : 'active');
  progressFill.style.background = paused ? '#facc15' : '#0d9488';

  if (activeGroupBtn) {
    activeGroupBtn.classList.add('active-fetch');
    const color = paused ? '#facc15' : '#2dd4bf';
    setButtonDot(activeGroupBtn, color, paused ? 'Paused' : 'Fetching');
  }

  isPaused = paused;
  btnPause.textContent = paused ? '\u25B6' : '\u23F8';
  btnPause.title = paused ? 'Resume' : 'Pause';
}

function showCompletionUI(countText) {
  progressRow.hidden = false;
  progressBarWrap.hidden = true;
  progressText.hidden = false;
  progressText.textContent = countText;
  btnPause.hidden = true;
  btnCancel.textContent = '\u2713';
  btnCancel.className = 'btn-cancel done';
  btnCancel.title = '';
  if (activeGroupBtn) {
    setButtonDot(activeGroupBtn, '#4ade80', 'Complete');
    activeGroupBtn.classList.add('success');
  }
}

function resetGroupUI() {
  // Disconnect port to stop queued messages from updating UI
  if (groupPort) {
    try { groupPort.disconnect(); } catch {}
  }
  btnSaveGroupMd.textContent = 'Save .md';
  btnSaveGroupZip.textContent = 'Save .zip';
  btnSaveGroupMd.classList.remove('success', 'active-fetch');
  btnSaveGroupZip.classList.remove('success', 'active-fetch');
  btnSaveGroupMd.disabled = false;
  btnSaveGroupZip.disabled = false;
  progressRow.hidden = true;
  groupPort = null;
  activeGroupBtn = null;
  isPaused = false;
  groupCancelled = false;
  if (discoveredUrls.length > 0) {
    groupCount.textContent = discoveredUrls.length + ' pages';
  }
}

// Shared message handler for both fresh start and reconnect
function attachGroupPortListeners() {
  groupPort.onMessage.addListener(async (msg) => {
    if (groupCancelled) return; // ignore queued messages after cancel
    if (msg.action === 'state') {
      if (msg.status === 'fetching' && msg.done > 0) {
        setActiveBtn(msg.format);
        isPaused = msg.paused;
        showFetchingUI(msg.done, msg.total, msg.paused);
      }
    } else if (msg.action === 'progress') {
      showFetchingUI(msg.done, msg.total, isPaused);
    } else if (msg.action === 'fetchComplete') {
      if (activeGroupBtn) activeGroupBtn.textContent = 'Converting...';
      groupCount.textContent = 'Converting...';
      groupPort.postMessage({ action: 'getResults' });
    } else if (msg.action === 'results') {
      const result = convertResults(msg.results);
      if (result.pages.length === 0) {
        showStatus('Failed to convert any pages', 'error');
        sendMessage({ action: 'setIcon', color: 'red' });
      } else {
        const ok = await buildAndDownload(result, msg.format, msg.filename);
        if (ok) {
          const countText = result.failCount > 0
            ? 'Saved ' + result.pages.length + ' of ' + result.total + ' pages'
            : 'Saved ' + result.pages.length + ' pages';
          showCompletionUI(countText);
          sendMessage({ action: 'setIcon', color: 'green' });
        }
      }
      groupPort.postMessage({ action: 'clear' });
      groupPort = null;
    }
  });
}

function startGroupSave(format) {
  if (format === 'md' && discoveredUrls.length > 50) {
    if (!confirm('Saving a large number of pages to a single .md file may be slow to open or unstable. Consider using .zip instead.\n\nContinue with .md?')) {
      return;
    }
  }

  const ext = format === 'zip' ? '.zip' : '.md';
  const filename = slugify(groupFilenameBase()) + ext;

  setActiveBtn(format);
  groupCancelled = false;
  showFetchingUI(0, discoveredUrls.length, false);

  sendMessage({ action: 'setIcon', color: 'teal' });
  groupPort = chrome.runtime.connect({ name: 'groupSave' });
  attachGroupPortListeners();
  groupPort.postMessage({ action: 'start', urls: discoveredUrls, format, filename });
}

function resumeGroupProgress() {
  groupPort = chrome.runtime.connect({ name: 'groupSave' });
  attachGroupPortListeners();
  // Service worker sends 'state' on connect if there's an active fetch
}

btnSaveGroupMd.addEventListener('click', () => startGroupSave('md'));
btnSaveGroupZip.addEventListener('click', () => startGroupSave('zip'));

btnPause.addEventListener('click', () => {
  if (!groupPort) return;
  if (isPaused) {
    isPaused = false;
    groupPort.postMessage({ action: 'resume' });
    btnPause.textContent = '\u23F8';
    btnPause.title = 'Pause';
    if (activeGroupBtn) setButtonDot(activeGroupBtn, '#2dd4bf', 'Fetching');
    groupCount.className = 'count-badge active';
    progressFill.style.background = '#0d9488';
    sendMessage({ action: 'setIcon', color: 'teal' });
  } else {
    isPaused = true;
    groupPort.postMessage({ action: 'pause' });
    btnPause.textContent = '\u25B6';
    btnPause.title = 'Resume';
    if (activeGroupBtn) setButtonDot(activeGroupBtn, '#facc15', 'Paused');
    groupCount.className = 'count-badge paused';
    progressFill.style.background = '#facc15';
    sendMessage({ action: 'setIcon', color: 'yellow' });
  }
});

btnCancel.addEventListener('click', () => {
  if (btnCancel.classList.contains('done')) {
    resetGroupUI();
    return;
  }
  if (!groupPort) return;
  // Block queued progress messages from updating UI while confirm is showing
  groupCancelled = true;
  if (!confirm('Stop fetching? All progress will be lost.')) {
    groupCancelled = false;
    return;
  }
  try {
    groupPort.postMessage({ action: 'cancel' });
    groupPort.postMessage({ action: 'clear' });
  } catch {}
  resetGroupUI();
  // Flash "Cancelled" in the header count, then restore
  groupCount.textContent = 'Cancelled';
  groupCount.className = 'count-badge cancelled';
  setTimeout(() => {
    if (discoveredUrls.length > 0) {
      groupCount.textContent = discoveredUrls.length + ' pages';
    }
    groupCount.className = 'count-badge';
  }, 2000);
  sendMessage({ action: 'setIcon', color: 'clear' });
});

btnLlmsCopy.addEventListener('click', async () => {
  btnLlmsCopy.disabled = true;
  try {
    const origin = new URL(currentTab.url).origin;
    const resp = await sendMessage({ action: 'fetchLlmsTxt', origin });
    if (resp && resp.error) { showStatus('Failed to fetch llms.txt', 'error'); return; }
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
    if (resp && resp.error) { showStatus('Failed to fetch llms.txt', 'error'); return; }
    await writeToHandle(handle, resp.content, filename);
    flashButton(btnLlmsSave, 'Saved!');
  } finally { btnLlmsSave.disabled = false; }
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

init();
