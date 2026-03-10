import * as cheerio from 'cheerio';

export function cleanHtml(html) {
  const $ = cheerio.load(html);
  $('nav, header, footer, script, style, aside, .sidebar, .menu, .navigation').remove();
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
      const code = $(el).find('code').text() || $(el).text();
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
      children.forEach((child, i) => {
        if (child.tagName === 'li') {
          const prefix = tag === 'ol' ? `${i + 1}. ` : '- ';
          lines.push(`${prefix}${textOf($, child)}`);
        }
      });
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

function textOf($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}

export function normalizeMarkdown(md) {
  return md.replace(/\n{3,}/g, '\n\n').trim();
}
