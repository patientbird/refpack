import * as cheerio from 'cheerio';

export function cleanHtml(html) {
  const $ = cheerio.load(html);

  // Remove boilerplate elements
  $('nav, header, footer, script, style, aside, noscript, svg').remove();
  $('.sidebar, .menu, .navigation, .breadcrumb, .toc, [class*="sidebar"], [class*="nav-"]').remove();

  // Remove copy/share buttons and their containers
  $('button').remove();
  $('[role="button"]').remove();
  // Remove "Copy" tooltips/labels (common in Mintlify, React docs, etc.)
  $('div, span').filter((_, el) => {
    const text = $(el).clone().children().remove().end().text().trim();
    return text === 'Copy' || text === 'Copy page' || text === 'Copied!';
  }).remove();

  // Normalize code blocks: convert div-per-line (CodeMirror/Sandpack) to newlines
  $('pre code div').each((_, div) => {
    $(div).replaceWith($(div).text() + '\n');
  });

  let root = findContentRoot($);
  const md = htmlToMarkdown($, root);
  return normalizeMarkdown(md);
}

// Content container selectors, ordered from most specific to least.
// Each doc framework uses different conventions — we try them all.
const CONTENT_SELECTORS = [
  '.mdx-content',         // Mintlify (Ollama, many API docs)
  '.markdown-body',       // GitHub-style markdown
  '[class*="prose"]',     // Tailwind Typography (widespread)
  '.doc-content',         // Generic doc sites
  '.content',             // Common CMS pattern
  '[role="main"]',        // ARIA landmark
  'main',                 // Semantic HTML
  'article',              // Semantic HTML
];

function findContentRoot($) {
  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector).first();
    if (el.length && el.text().trim().length > 50) return el;
  }
  return $('body').first();
}

function htmlToMarkdown($, root) {
  const lines = [];
  function walk(el) {
    if (el.type === 'text') {
      const text = el.data.replace(/\s+/g, ' ');
      if (text.trim()) lines.push(text.trim());
      return;
    }
    if (el.type !== 'tag') return;
    const tag = el.tagName;
    const children = el.children || [];
    if (tag === 'h1') { lines.push(`\n# ${textOf($, el)}\n`); return; }
    if (tag === 'h2') { lines.push(`\n## ${textOf($, el)}\n`); return; }
    if (tag === 'h3') { lines.push(`\n### ${textOf($, el)}\n`); return; }
    if (tag === 'h4') { lines.push(`\n#### ${textOf($, el)}\n`); return; }
    if (tag === 'h5') { lines.push(`\n##### ${textOf($, el)}\n`); return; }
    if (tag === 'h6') { lines.push(`\n###### ${textOf($, el)}\n`); return; }
    if (tag === 'p' || tag === 'span') { lines.push(`\n${inlineToMarkdown($, el)}\n`); return; }
    if (tag === 'pre') {
      const code = ($(el).find('code').text() || $(el).text()).trimEnd();
      lines.push(`\n\`\`\`\n${code}\n\`\`\`\n`);
      return;
    }
    if (tag === 'code' && el.parent?.tagName !== 'pre') {
      lines.push(`\`${textOf($, el)}\``);
      return;
    }
    if (tag === 'a') {
      const href = $(el).attr('href') || '';
      lines.push(`[${textOf($, el)}](${href})`);
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      walkList($, el, lines, 0);
      lines.push('');
      return;
    }
    if (tag === 'table') {
      const rows = $(el).find('tr');
      rows.each((i, row) => {
        const cells = $(row).find('th, td');
        const cellTexts = [];
        cells.each((_, cell) => {
          const colspan = parseInt($(cell).attr('colspan') || '1', 10);
          const text = cellTextOf($, cell);
          cellTexts.push(text);
          // Fill extra columns for colspan
          for (let c = 1; c < colspan; c++) cellTexts.push('');
        });
        lines.push(`| ${cellTexts.join(' | ')} |`);
        if (i === 0) {
          lines.push(`| ${cellTexts.map(() => '---').join(' | ')} |`);
        }
      });
      lines.push('');
      return;
    }
    children.forEach((child) => walk(child));
  }
  root.contents().each((_, el) => walk(el));
  return lines.join('\n');
}

function walkList($, listEl, lines, depth) {
  const tag = listEl.tagName || $(listEl).prop('tagName')?.toLowerCase();
  const indent = '  '.repeat(depth);
  const children = listEl.children || $(listEl).contents().toArray();
  let itemIndex = 0;
  children.forEach((child) => {
    if (child.tagName === 'li') {
      itemIndex++;
      const prefix = tag === 'ol' ? `${itemIndex}. ` : '- ';
      // Get direct text of the li (excluding nested lists)
      const liText = $(child).contents().toArray()
        .filter(c => c.tagName !== 'ul' && c.tagName !== 'ol')
        .map(c => $(c).text())
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (liText) lines.push(`${indent}${prefix}${liText}`);
      // Recurse into nested lists
      $(child).children('ul, ol').each((_, nested) => {
        walkList($, nested, lines, depth + 1);
      });
    }
  });
}

function inlineToMarkdown($, el) {
  const parts = [];
  $(el).contents().each((_, child) => {
    if (child.type === 'text') {
      parts.push(child.data.replace(/\s+/g, ' '));
    } else if (child.tagName === 'code') {
      parts.push(`\`${$(child).text().trim()}\``);
    } else if (child.tagName === 'a') {
      const href = $(child).attr('href') || '';
      parts.push(`[${$(child).text().trim()}](${href})`);
    } else if (child.tagName === 'strong' || child.tagName === 'b') {
      parts.push(`**${$(child).text().trim()}**`);
    } else if (child.tagName === 'em' || child.tagName === 'i') {
      parts.push(`*${$(child).text().trim()}*`);
    } else {
      parts.push($(child).text().replace(/\s+/g, ' '));
    }
  });
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function cellTextOf($, el) {
  // Extract text content + image alt text for table cells
  const parts = [];
  $(el).contents().each((_, child) => {
    if (child.type === 'text') {
      const t = child.data.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    } else if (child.tagName === 'img') {
      const alt = $(child).attr('alt') || $(child).attr('title') || '';
      if (alt) parts.push(alt);
    } else {
      // Check for images inside nested elements
      const imgs = $(child).find('img');
      if (imgs.length) {
        imgs.each((_, img) => {
          const alt = $(img).attr('alt') || $(img).attr('title') || '';
          if (alt) parts.push(alt);
        });
      }
      const t = $(child).text().replace(/\s+/g, ' ').trim();
      if (t && !imgs.length) parts.push(t);
    }
  });
  // Deduplicate when image alt matches adjacent text (e.g., Pokemon name + sprite)
  const deduped = parts.filter((p, i) => i === 0 || p !== parts[i - 1]);
  return deduped.join(' ').trim();
}

function textOf($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}

export function normalizeMarkdown(md) {
  let result = md.replace(/\n{3,}/g, '\n\n').trim();
  // Strip leading breadcrumb-style lines (bare markdown links before the first heading)
  result = result.replace(/^(\[.*?\]\(.*?\)\s*\n)+/, '');
  return result.trim();
}
