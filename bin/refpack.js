#!/usr/bin/env node
import { program } from 'commander';

program
  .name('refpack')
  .description('Build shareable reference packs from web pages, PDFs, and local files')
  .version('0.1.0');

program.parse();
