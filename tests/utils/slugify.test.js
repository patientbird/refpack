import { describe, it, expect } from 'vitest';
import { slugify } from '../../src/utils/slugify.js';

describe('slugify', () => {
  it('converts a simple title to a slug', () => {
    expect(slugify('Sponsored Products')).toBe('sponsored-products');
  });
  it('handles URLs', () => {
    expect(slugify('https://example.com/docs/api-reference')).toBe('api-reference');
  });
  it('strips special characters', () => {
    expect(slugify('Hello, World! (2026)')).toBe('hello-world-2026');
  });
  it('collapses multiple hyphens', () => {
    expect(slugify('foo---bar')).toBe('foo-bar');
  });
  it('trims leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });
  it('handles empty string', () => {
    expect(slugify('')).toBe('untitled');
  });
});
