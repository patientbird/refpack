---
name: refpack
description: Use the refpack CLI to scrape websites, PDFs, and local files into clean local markdown. Trigger when the user wants to save website content locally, scrape documentation, download docs for offline or LLM use, or says things like "save all the docs from [site]" — even if they don't mention refpack by name.
---

# refpack

refpack is a globally installed CLI tool that scrapes web pages, PDFs, and local files into clean markdown. It auto-discovers related pages via sitemap or link crawling and fetches concurrently.

## Commands

```bash
refpack init <name>          # Create a new refpack (creates directory + recipe.json)
refpack add <url>            # Add URL — auto-discovers related pages
refpack add --single <url>   # Add single page only (skip discovery)
refpack add --sitemap <url>  # Add sitemap directly
refpack add ./file.md        # Add local file, directory, or PDF
refpack add -y <url>         # Skip confirmation prompts
refpack build                # Fetch all sources → clean markdown in refs/
refpack list                 # Show sources
refpack remove <source>      # Remove a source
```

## Workflow

```bash
refpack init react-docs
cd react-docs
refpack add https://react.dev/reference/react   # discovers ~50 pages, confirms
refpack build                                     # fetches + converts to refs/
```

Output: `refs/` folder with clean markdown files (one per page), plus `recipe.json` (shareable) and `refpack.json` (manifest).

## After Building: Generate a Reference Index

After a successful build, read 5-8 sample files from `refs/` (pick a spread — first, last, middle, different sizes) and write a `reference.md` in the refpack directory using this template:

```markdown
# [Pack Name] Reference

## How to Search
[How files are named — what pattern maps to what content]
[How content is structured — headings, tables, sections]
[Table column meanings if tables are present]

## How to Read Results
[Every abbreviation and shorthand mapped to its full meaning]
[Domain-specific terminology explained]
[Any non-obvious patterns — conditional sections, special categories, etc.]
```

Save to `reference.md` in the refpack root (next to `recipe.json`). This makes future queries faster — especially when the content uses abbreviations or jargon.

## Notes

- Run `add`, `build`, `list`, `remove` from inside the refpack directory
- Auto-discovery filters by path prefix: `docs.site.com/api` only gets `/api` pages
- 10 concurrent fetches, 100ms batch delay, 30s timeout
