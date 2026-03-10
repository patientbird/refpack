import { readRecipe } from '../utils/recipe.js';

export function runList(packDir) {
  const recipe = readRecipe(packDir);
  if (!recipe) {
    throw new Error('No refpack found in this directory. Run "refpack init" first.');
  }
  if (recipe.sources.length === 0) {
    console.log(`${recipe.name}: no sources added yet.`);
  } else {
    console.log(`${recipe.name} (${recipe.sources.length} sources):\n`);
    recipe.sources.forEach((s, i) => {
      console.log(`  ${i + 1}. [${s.type}] ${s.value}`);
    });
  }
  return recipe.sources;
}
