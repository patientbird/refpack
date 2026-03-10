import * as cheerio from 'cheerio';

export function cleanHtml(html) {
  const $ = cheerio.load(html);

  // Remove boilerplate elements
  $('nav, header, footer, script, style, aside, noscript, svg').remove();
  $('.sidebar, .menu, .navigation, .breadcrumb, .toc').remove();

  // Remove copy/share buttons and their containers
  $('button').remove();
  $('[role="button"]').remove();
  $('span').filter((_, el) => {
    const text = $(el).text().trim();
    return text === 'Copy' || text === 'Copy page';
  }).remove();

  // Normalize code blocks: convert div-per-line (CodeMirror/Sandpack) to newlines
  $('pre code div').each((_, div) => {
    $(div).replaceWith($(div).text() + '\n');
  });

  let root = $('main').first();
  if (!root.length) root = $('article').first();
  if (!root.length) root = $('body').first();
  const md = htmlToMarkdown($, root);
  return normalizeMarkdown(md);
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
    if (tag === 'p') { lines.push(`\n${textOf($, el)}\n`); return; }
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
        cells.each((_, cell) => cellTexts.push(textOf($, cell)));
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

function textOf($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}

export function normalizeMarkdown(md) {
  let result = md.replace(/\n{3,}/g, '\n\n').trim();
  // Strip leading breadcrumb-style lines (bare markdown links before the first heading)
  result = result.replace(/^(\[.*?\]\(.*?\)\s*\n)+/, '');
  return result.trim();
}
