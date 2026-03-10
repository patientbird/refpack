import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readRecipe, writeRecipe, addSource, removeSource } from '../../src/utils/recipe.js';

describe('recipe', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refpack-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  it('writeRecipe creates a valid recipe.json', () => {
    const recipe = { name: 'test-pack', sources: [] };
    writeRecipe(tmpDir, recipe);
    const content = JSON.parse(fs.readFileSync(path.join(tmpDir, 'recipe.json'), 'utf-8'));
    expect(content.name).toBe('test-pack');
    expect(content.sources).toEqual([]);
  });
  it('readRecipe reads an existing recipe.json', () => {
    const recipe = { name: 'test-pack', sources: [] };
    writeRecipe(tmpDir, recipe);
    const result = readRecipe(tmpDir);
    expect(result.name).toBe('test-pack');
  });
  it('readRecipe returns null if no recipe.json exists', () => {
    const result = readRecipe(tmpDir);
    expect(result).toBeNull();
  });
  it('addSource adds a source to the recipe', () => {
    const recipe = { name: 'test-pack', sources: [] };
    const updated = addSource(recipe, { type: 'url', value: 'https://example.com' });
    expect(updated.sources).toHaveLength(1);
    expect(updated.sources[0].type).toBe('url');
  });
  it('addSource does not duplicate existing sources', () => {
    const recipe = {
      name: 'test-pack',
      sources: [{ type: 'url', value: 'https://example.com' }]
    };
    const updated = addSource(recipe, { type: 'url', value: 'https://example.com' });
    expect(updated.sources).toHaveLength(1);
  });
  it('removeSource removes a source by value', () => {
    const recipe = {
      name: 'test-pack',
      sources: [{ type: 'url', value: 'https://example.com' }]
    };
    const updated = removeSource(recipe, 'https://example.com');
    expect(updated.sources).toHaveLength(0);
  });
});
