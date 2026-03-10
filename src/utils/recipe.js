import fs from 'fs';
import path from 'path';

const RECIPE_FILE = 'recipe.json';

export function readRecipe(dir) {
  const filePath = path.join(dir, RECIPE_FILE);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function writeRecipe(dir, recipe) {
  const filePath = path.join(dir, RECIPE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2) + '\n');
}

export function addSource(recipe, source) {
  const exists = recipe.sources.some(
    (s) => s.type === source.type && s.value === source.value
  );
  if (exists) return recipe;
  return { ...recipe, sources: [...recipe.sources, source] };
}

export function removeSource(recipe, value) {
  return {
    ...recipe,
    sources: recipe.sources.filter((s) => s.value !== value),
  };
}
