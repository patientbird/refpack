import { describe, it, expect } from 'vitest';
import { cleanHtml, normalizeMarkdown } from '../../src/pipeline/cleaner.js';

describe('cleanHtml', () => {
  it('extracts main content from HTML', () => {
    const html = `
      <html><body>
        <nav><a href="/">Home</a></nav>
        <main><h1>Title</h1><p>Content here.</p></main>
        <footer>Footer</footer>
      </body></html>
    `;
    const result = cleanHtml(html);
    expect(result).toContain('# Title');
    expect(result).toContain('Content here.');
    expect(result).not.toContain('Home');
    expect(result).not.toContain('Footer');
  });
  it('preserves code blocks', () => {
    const html = '<main><pre><code>const x = 1;</code></pre></main>';
    const result = cleanHtml(html);
    expect(result).toContain('const x = 1;');
  });
  it('preserves tables', () => {
    const html = '<main><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></main>';
    const result = cleanHtml(html);
    expect(result).toContain('A');
    expect(result).toContain('1');
  });
  it('handles HTML with no main tag by using body', () => {
    const html = '<html><body><h1>Title</h1><p>Content</p></body></html>';
    const result = cleanHtml(html);
    expect(result).toContain('# Title');
    expect(result).toContain('Content');
  });
  it('removes copy/share buttons', () => {
    const html = '<main><h1>Title</h1><button>Copy</button><span>Copy page</span><p>Content</p></main>';
    const result = cleanHtml(html);
    expect(result).not.toContain('Copy');
    expect(result).toContain('Content');
  });
  it('removes SVG elements', () => {
    const html = '<main><h1>Title</h1><svg><path d="M0 0"/></svg><p>Content</p></main>';
    const result = cleanHtml(html);
    expect(result).not.toContain('path');
    expect(result).not.toContain('svg');
  });
  it('preserves newlines in CodeMirror-style code blocks', () => {
    const html = `<main><pre><code>
      <div class="cm-line">const x = 1;</div>
      <div class="cm-line">const y = 2;</div>
    </code></pre></main>`;
    const result = cleanHtml(html);
    expect(result).toContain('const x = 1;\n');
    expect(result).toContain('const y = 2;\n');
  });
  it('handles nested lists with proper indentation', () => {
    const html = `<main><ul>
      <li>Reference
        <ul>
          <li>useState</li>
          <li>useEffect</li>
        </ul>
      </li>
      <li>Usage
        <ul>
          <li>Adding state</li>
        </ul>
      </li>
    </ul></main>`;
    const result = cleanHtml(html);
    expect(result).toContain('- Reference');
    expect(result).toContain('  - useState');
    expect(result).toContain('  - useEffect');
    expect(result).toContain('- Usage');
    expect(result).toContain('  - Adding state');
  });
  it('removes breadcrumb navigation', () => {
    const html = '<main><div class="breadcrumb"><a href="/">Home</a> > <a href="/docs">Docs</a></div><h1>Title</h1></main>';
    const result = cleanHtml(html);
    expect(result).not.toContain('Home');
    expect(result).toContain('# Title');
  });
});

describe('normalizeMarkdown', () => {
  it('collapses excessive blank lines', () => {
    const input = 'Line 1\n\n\n\n\nLine 2';
    expect(normalizeMarkdown(input)).toBe('Line 1\n\nLine 2');
  });
  it('strips leading breadcrumb links', () => {
    const input = '[API Reference](/ref)\n[Hooks](/hooks)\n\n# useState\n\nContent here.';
    const result = normalizeMarkdown(input);
    expect(result).not.toContain('API Reference');
    expect(result).toMatch(/^# useState/);
  });
  it('trims leading and trailing whitespace', () => {
    const input = '\n\n  # Title\n\nContent\n\n';
    const result = normalizeMarkdown(input);
    expect(result).toMatch(/^# Title/);
    expect(result).toMatch(/Content$/);
  });
});
