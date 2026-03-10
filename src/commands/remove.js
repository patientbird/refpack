import { readRecipe, writeRecipe, removeSource } from '../utils/recipe.js';

export function runRemove(packDir, sourceValue) {
  const recipe = readRecipe(packDir);
  if (!recipe) {
    throw new Error('No refpack found in this directory. Run "refpack init" first.');
  }
  const before = recipe.sources.length;
  const updated = removeSource(recipe, sourceValue);
  writeRecipe(packDir, updated);
  if (updated.sources.length < before) {
    console.log(`Removed source: ${sourceValue}`);
  } else {
    console.log(`Source not found: ${sourceValue}`);
  }
}
