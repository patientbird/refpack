#!/usr/bin/env node
import { program } from 'commander';
import path from 'path';
import { runInit } from '../src/commands/init.js';
import { runAdd } from '../src/commands/add.js';
import { runBuild } from '../src/commands/build.js';
import { runList } from '../src/commands/list.js';
import { runRemove } from '../src/commands/remove.js';
import { ask } from '../src/utils/prompt.js';

program
  .name('refpack')
  .description('Build shareable reference packs from web pages, PDFs, and local files')
  .version('0.1.0');

program
  .command('init <name>')
  .description('Create a new refpack project')
  .option('-y, --yes', 'Skip location confirmation')
  .action(async (name, options) => {
    let packDir = path.resolve(name);

    if (options.yes) {
      runInit(packDir, name);
      return;
    }

    while (true) {
      console.log(`\nCreate refpack at: ${packDir}`);
      const answer = await ask('Confirm location (Y/n/path): ');

      if (answer === '' || answer.toLowerCase() === 'y') {
        runInit(packDir, name);
        return;
      }
      if (answer.toLowerCase() === 'n') {
        console.log('Cancelled.');
        return;
      }
      // User entered a custom path
      packDir = path.resolve(answer, name);
    }
  });

program
  .command('add <source>')
  .description('Add a source (URL, file, or directory)')
  .option('--sitemap', 'Treat the URL as a sitemap')
  .action((source, options) => {
    runAdd(process.cwd(), source, options);
  });

program
  .command('build')
  .description('Build the refpack from all sources')
  .action(async () => {
    await runBuild(process.cwd());
  });

program
  .command('list')
  .description('List all sources in the refpack')
  .action(() => {
    runList(process.cwd());
  });

program
  .command('remove <source>')
  .description('Remove a source by its value')
  .action((source) => {
    runRemove(process.cwd(), source);
  });

program.parse();
