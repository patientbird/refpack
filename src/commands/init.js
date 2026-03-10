import fs from 'fs';
import { writeRecipe } from '../utils/recipe.js';

export function runInit(packDir, name) {
  if (fs.existsSync(packDir)) {
    throw new Error(`Directory "${name}" already exists.`);
  }
  fs.mkdirSync(packDir, { recursive: true });
  writeRecipe(packDir, { name, sources: [] });
  console.log(`Created refpack "${name}" at ${packDir}`);
}
