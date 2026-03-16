/**
 * Background service worker for the llms.txt browser extension.
 * Detects llms.txt files on visited pages and manages the extension badge.
 */

/**
 * Check if a given origin has an llms.txt file.
 * Uses session cache to avoid redundant network requests.
 * @param {string} origin
 * @returns {Promise<boolean>}
 */
async function checkLlmsTxt(origin) {
  try {
    const cacheKey = 'llms:' + origin;
    const cached = await chrome.storage.session.get(cacheKey);

    if (cacheKey in cached) {
      return cached[cacheKey];
    }

    let found = false;
    try {
      const resp = await fetch(origin + '/llms.txt', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      const contentType = resp.headers.get('content-type') || '';
      found = resp.ok && contentType.includes('text');
    } catch (_fetchErr) {
      found = false;
    }

    await chrome.storage.session.set({ [cacheKey]: found });
    return found;
  } catch (_err) {
    return false;
  }
}

/**
 * Update the extension badge for a given tab based on whether llms.txt was found.
 * @param {number} tabId
 * @param {boolean} found
 */
function updateBadge(tabId, found) {
  if (found) {
    chrome.action.setBadgeText({ text: '●', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

// ─── Tab Listeners ────────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  let origin;
  try {
    origin = new URL(tab.url).origin;
  } catch (_e) {
    return;
  }

  if (!origin.startsWith('http')) return;

  const found = await checkLlmsTxt(origin);
  updateBadge(tabId, found);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (_e) {
    return;
  }

  if (!tab.url) return;

  let origin;
  try {
    origin = new URL(tab.url).origin;
  } catch (_e) {
    return;
  }

  if (!origin.startsWith('http')) return;

  const found = await checkLlmsTxt(origin);
  updateBadge(tabId, found);
});

// ─── Message Handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // ── checkLlmsTxt ──────────────────────────────────────────────────────────
  if (msg.action === 'checkLlmsTxt') {
    checkLlmsTxt(msg.origin).then((found) => sendResponse({ found }));
    return true;
  }

  // ── fetchLlmsTxt ──────────────────────────────────────────────────────────
  if (msg.action === 'fetchLlmsTxt') {
    (async () => {
      try {
        const resp = await fetch(msg.origin + '/llms.txt', {
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
          const content = await resp.text();
          sendResponse({ content });
        } else {
          sendResponse({ error: `HTTP ${resp.status}` });
        }
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  // ── injectAndConvert ──────────────────────────────────────────────────────
  if (msg.action === 'injectAndConvert') {
    (async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: msg.tabId },
          files: ['lib/turndown.js', 'content/content.js'],
        });
        const response = await chrome.tabs.sendMessage(msg.tabId, { action: 'convert' });
        sendResponse(response);
      } catch (err) {
        sendResponse({ error: 'Cannot access this page: ' + err.message });
      }
    })();
    return true;
  }

  // ── injectAndGetLinks ─────────────────────────────────────────────────────
  if (msg.action === 'injectAndGetLinks') {
    (async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: msg.tabId },
          files: ['lib/turndown.js', 'content/content.js'],
        });
        const response = await chrome.tabs.sendMessage(msg.tabId, { action: 'getGroupLinks' });
        sendResponse(response);
      } catch (err) {
        sendResponse({ error: 'Cannot access this page: ' + err.message });
      }
    })();
    return true;
  }

  // ── fetchPages ────────────────────────────────────────────────────────────
  if (msg.action === 'fetchPages') {
    (async () => {
      const results = [];
      for (const url of msg.urls) {
        try {
          const resp = await fetch(url, {
            signal: AbortSignal.timeout(15000),
            headers: { Accept: 'text/html' },
          });
          const contentType = resp.headers.get('content-type') || '';
          if (resp.ok && contentType.includes('text/html')) {
            const html = await resp.text();
            results.push({ url, html });
          } else {
            results.push({ url, error: `HTTP ${resp.status} or unexpected content-type: ${contentType}` });
          }
        } catch (err) {
          results.push({ url, error: err.message });
        }

        // 100ms delay between requests
        if (url !== msg.urls[msg.urls.length - 1]) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      sendResponse({ results });
    })();
    return true;
  }
});
