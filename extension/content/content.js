/* Content script — port of refpack CLI's cleaner.js using native DOM APIs */

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
  'nav, header, footer, script, style, aside, noscript, svg, ' +
  '.sidebar, .menu, .navigation, .breadcrumb, .toc, [class*="sidebar"], ' +
  'button, [role="button"]';

function findContentRoot(doc) {
  for (const selector of CONTENT_SELECTORS) {
    const el = doc.querySelector(selector);
    if (el && el.textContent.trim().length > 50) return el;
  }
  return doc.body;
}

function textOf(el) {
  return el.textContent.replace(/\s+/g, ' ').trim();
}

function inlineToMarkdown(el) {
  const parts = [];
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      parts.push(child.data.replace(/\s+/g, ' '));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'code') {
        parts.push('`' + child.textContent.trim() + '`');
      } else if (tag === 'a') {
        const href = child.getAttribute('href') || '';
        parts.push('[' + child.textContent.trim() + '](' + href + ')');
      } else if (tag === 'strong' || tag === 'b') {
        parts.push('**' + child.textContent.trim() + '**');
      } else if (tag === 'em' || tag === 'i') {
        parts.push('*' + child.textContent.trim() + '*');
      } else {
        parts.push(child.textContent.replace(/\s+/g, ' '));
      }
    }
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function cellTextOf(el) {
  const parts = [];
  function extractParts(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.data.replace(/\s+/g, ' ').trim();
        if (t) parts.push(t);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'img') {
          const alt = child.getAttribute('alt') || child.getAttribute('title') || '';
          if (alt) parts.push(alt);
        } else if (tag === 'br') {
          // skip
        } else {
          extractParts(child);
        }
      }
    }
  }
  extractParts(el);
  const deduped = parts.filter((p) => {
    return !parts.some((other) => other !== p && other.includes(p));
  });
  return deduped.join(' ').trim();
}

function walkList(listEl, lines, depth) {
  const tag = listEl.tagName.toLowerCase();
  const indent = '  '.repeat(depth);
  let itemIndex = 0;
  for (const child of listEl.children) {
    if (child.tagName.toLowerCase() === 'li') {
      itemIndex++;
      const prefix = tag === 'ol' ? itemIndex + '. ' : '- ';
      // Get direct text excluding nested lists
      const textParts = [];
      for (const c of child.childNodes) {
        if (c.nodeType === Node.ELEMENT_NODE) {
          const cTag = c.tagName.toLowerCase();
          if (cTag === 'ul' || cTag === 'ol') continue;
        }
        textParts.push(c.textContent);
      }
      const liText = textParts.join('').replace(/\s+/g, ' ').trim();
      if (liText) lines.push(indent + prefix + liText);
      // Recurse into nested lists
      for (const nested of child.children) {
        const nTag = nested.tagName.toLowerCase();
        if (nTag === 'ul' || nTag === 'ol') {
          walkList(nested, lines, depth + 1);
        }
      }
    }
  }
}

function htmlToMarkdown(root) {
  const lines = [];

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.data.replace(/\s+/g, ' ');
      if (text.trim()) lines.push(text.trim());
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    if (tag === 'h1') { lines.push('\n# ' + textOf(node) + '\n'); return; }
    if (tag === 'h2') { lines.push('\n## ' + textOf(node) + '\n'); return; }
    if (tag === 'h3') { lines.push('\n### ' + textOf(node) + '\n'); return; }
    if (tag === 'h4') { lines.push('\n#### ' + textOf(node) + '\n'); return; }
    if (tag === 'h5') { lines.push('\n##### ' + textOf(node) + '\n'); return; }
    if (tag === 'h6') { lines.push('\n###### ' + textOf(node) + '\n'); return; }

    if (tag === 'p' || tag === 'span') {
      lines.push('\n' + inlineToMarkdown(node) + '\n');
      return;
    }

    if (tag === 'pre') {
      const codeEl = node.querySelector('code');
      const code = (codeEl ? codeEl.textContent : node.textContent).trimEnd();
      lines.push('\n```\n' + code + '\n```\n');
      return;
    }

    if (tag === 'code' && node.parentElement && node.parentElement.tagName.toLowerCase() !== 'pre') {
      lines.push('`' + textOf(node) + '`');
      return;
    }

    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      lines.push('[' + textOf(node) + '](' + href + ')');
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      walkList(node, lines, 0);
      lines.push('');
      return;
    }

    if (tag === 'table') {
      const rows = node.querySelectorAll('tr');
      rows.forEach((row, i) => {
        const cells = row.querySelectorAll('th, td');
        const cellTexts = [];
        cells.forEach((cell) => {
          const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
          const cls = cell.getAttribute('class') || '';
          const isInactive = /\b(blank|inactive|disabled)\b/.test(cls);
          const text = isInactive ? '' : cellTextOf(cell);
          cellTexts.push(text);
          for (let c = 1; c < colspan; c++) cellTexts.push('');
        });
        lines.push('| ' + cellTexts.join(' | ') + ' |');
        if (i === 0) {
          lines.push('| ' + cellTexts.map(() => '---').join(' | ') + ' |');
        }
      });
      lines.push('');
      return;
    }

    // Recurse into children
    for (const child of node.childNodes) {
      walk(child);
    }
  }

  for (const child of root.childNodes) {
    walk(child);
  }
  return lines.join('\n');
}

function normalizeMarkdown(md) {
  let result = md.replace(/\n{3,}/g, '\n\n').trim();
  result = result.replace(/^(\[.*?\]\(.*?\)\s*\n)+/, '');
  return result.trim();
}

function cleanAndConvert(doc) {
  // Remove boilerplate
  doc.querySelectorAll(REMOVE_SELECTORS).forEach(el => el.remove());

  // Remove "Copy" tooltips
  doc.querySelectorAll('div, span').forEach(el => {
    // Check own direct text only (like CLI's clone().children().remove().end().text())
    let ownText = '';
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) ownText += child.data;
    }
    ownText = ownText.trim();
    if (ownText === 'Copy' || ownText === 'Copy page' || ownText === 'Copied!') {
      el.remove();
    }
  });

  // Normalize code blocks: convert div-per-line to newlines
  doc.querySelectorAll('pre code div').forEach(div => {
    const text = document.createTextNode(div.textContent + '\n');
    div.replaceWith(text);
  });

  const root = findContentRoot(doc);
  const md = htmlToMarkdown(root);
  return normalizeMarkdown(md);
}

function convertToMarkdown() {
  // Clone the document so we don't mutate the live page
  const clone = document.cloneNode(true);
  return cleanAndConvert(clone);
}

function convertHtmlString(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return {
    markdown: cleanAndConvert(doc),
    title: doc.title,
  };
}

function getPageGroupLinks() {
  const currentUrl = new URL(window.location.href);
  const basePath = currentUrl.pathname.replace(/\/+$/, '') || '/';
  const currentNormalized = currentUrl.origin + basePath;

  const seen = new Set();
  const links = [];

  document.querySelectorAll('a[href]').forEach(a => {
    try {
      const linkUrl = new URL(a.href, window.location.href);
      if (linkUrl.origin !== currentUrl.origin) return;
      const linkPath = linkUrl.pathname.replace(/\/+$/, '') || '/';
      // Match child pages: must be under basePath/ (like CLI's isUnderPath)
      if (!(linkPath.startsWith(basePath + '/') || linkPath === basePath)) return;
      const normalized = linkUrl.origin + linkPath;
      // Skip the current page itself
      if (normalized === currentNormalized) return;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        links.push(normalized);
      }
    } catch { /* skip */ }
  });

  links.sort();
  return links;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'convert') {
    try {
      const markdown = convertToMarkdown();
      sendResponse({ markdown, title: document.title, url: window.location.href });
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
  } else if (message.action === 'convertHtml') {
    try {
      const result = convertHtmlString(message.html);
      sendResponse(result);
    } catch (err) {
      sendResponse({ error: err.message });
    }
  }
  return true;
});
