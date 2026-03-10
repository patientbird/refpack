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
});

describe('normalizeMarkdown', () => {
  it('collapses excessive blank lines', () => {
    const input = 'Line 1\n\n\n\n\nLine 2';
    expect(normalizeMarkdown(input)).toBe('Line 1\n\nLine 2');
  });
  it('trims leading and trailing whitespace', () => {
    const input = '\n\n  # Title\n\nContent\n\n';
    const result = normalizeMarkdown(input);
    expect(result).toMatch(/^# Title/);
    expect(result).toMatch(/Content$/);
  });
});
