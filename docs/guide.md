# refpack — How To Guide

## What is refpack?

refpack is a CLI tool that builds **reference packs** — clean, structured collections of documentation from any combination of web pages, PDFs, and local files. You define your sources, refpack crawls and cleans them, and you get a folder of markdown files ready to feed into any RAG pipeline, local LLM, or AI coding agent.

Think of it as a package manager for reference material. Once you build a pack, the recipe is shareable — anyone can rebuild the same pack from `recipe.json`.

## Quick Start

### 1. Create a new refpack

```bash
refpack init my-project-docs
cd my-project-docs
```

This creates a directory with an empty `recipe.json`:

```
my-project-docs/
└── recipe.json    # { "name": "my-project-docs", "sources": [] }
```

### 2. Add sources

Add any mix of URLs, sitemaps, local files, or PDFs:

```bash
# A single web page
refpack add https://docs.example.com/getting-started

# All pages from a sitemap
refpack add --sitemap https://docs.example.com/sitemap.xml

# A local markdown or text file
refpack add ./my-notes.md
refpack add ./meeting-notes.txt

# An entire folder of .md and .txt files
refpack add ./research-notes/

# A PDF document
refpack add ./whitepaper.pdf
```

Each source is recorded in `recipe.json`. You can check what you've added:

```bash
refpack list
```

Output:
```
my-project-docs (4 sources):

  1. [url] https://docs.example.com/getting-started
  2. [sitemap] https://docs.example.com/sitemap.xml
  3. [file] ./my-notes.md
  4. [pdf] ./whitepaper.pdf
```

Remove a source you don't want:

```bash
refpack remove ./my-notes.md
```

### 3. Build the pack

```bash
refpack build
```

refpack fetches every source, converts HTML to clean markdown (stripping navigation, footers, ads), extracts text from PDFs, normalizes formatting, and writes everything to the `refs/` folder:

```
my-project-docs/
├── refpack.json      # Manifest (name, file count, build date, size)
├── recipe.json       # Build recipe (list of sources)
└── refs/
    ├── getting-started.md
    ├── api-reference.md
    ├── faq.md
    ├── my-notes.md
    └── whitepaper.md
```

That's it. The `refs/` folder is your reference pack.

## Using Your Refpack

### With a RAG tool (AnythingLLM, LlamaIndex, etc.)

Point your RAG tool at the `refs/` directory. The files are clean markdown — any tool that can index markdown will work:

- **AnythingLLM:** Upload the `refs/` folder as a workspace document source
- **LlamaIndex:** Use `SimpleDirectoryReader("./my-project-docs/refs/")`
- **LangChain:** Use `DirectoryLoader` pointed at `refs/`

### With a local LLM (Ollama, LM Studio)

Copy relevant files from `refs/` into your prompt context, or set up a simple search:

```bash
# Find docs about authentication
grep -rl "authentication" refs/

# Read a specific reference
cat refs/api-reference.md
```

### With an AI coding agent

Drop the `refs/` folder into your project and reference it in your agent's context:

```bash
# Copy into your project
cp -r my-project-docs/refs/ ./docs/reference/

# Or symlink it
ln -s /path/to/my-project-docs/refs/ ./docs/reference
```

## Source Types Explained

### URLs (`refpack add <url>`)

Fetches a single web page, strips navigation/header/footer/sidebar boilerplate, and converts the main content to markdown. Preserves headings, code blocks, tables, and links.

```bash
refpack add https://react.dev/reference/react/useState
```

### Sitemaps (`refpack add --sitemap <url>`)

Fetches a sitemap XML file, extracts all listed URLs, then fetches and converts each one. Great for pulling an entire documentation site:

```bash
refpack add --sitemap https://docs.example.com/sitemap.xml
```

### Local files (`refpack add <path>`)

Copies local `.md` and `.txt` files into the pack, normalizing formatting (collapsing blank lines, trimming whitespace).

```bash
refpack add ./notes.md
refpack add ./research/        # adds all .md and .txt files in the directory
```

### PDFs (`refpack add <path.pdf>`)

Extracts text from PDF files and converts to markdown. Works best with text-based PDFs (scanned documents will have limited results).

```bash
refpack add ./api-guide.pdf
```

## Output Files

### `refs/` — The reference files

Clean markdown files, one per source page/document. This is what you feed into your RAG pipeline or reference directly.

File names are generated from the page title or URL. Duplicates get a numeric suffix (`page.md`, `page-2.md`).

### `refpack.json` — The manifest

Metadata about the built pack:

```json
{
  "name": "my-project-docs",
  "version": "1.0.0",
  "builtAt": "2026-03-10T12:00:00.000Z",
  "sources": 4,
  "files": 12,
  "totalSize": "1.2MB",
  "fileList": [
    "refs/getting-started.md",
    "refs/api-reference.md"
  ]
}
```

### `recipe.json` — The build recipe

The list of sources used to build the pack. This is the shareable part — give someone your `recipe.json` and they can rebuild the same pack:

```json
{
  "name": "my-project-docs",
  "sources": [
    { "type": "url", "value": "https://docs.example.com/getting-started" },
    { "type": "sitemap", "value": "https://docs.example.com/sitemap.xml" },
    { "type": "pdf", "value": "./api-guide.pdf" }
  ]
}
```

## Example: Building an Amazon Advertising Refpack

A real-world example — aggregating Amazon's scattered advertising documentation:

```bash
# Create the pack
refpack init amazon-advertising
cd amazon-advertising

# Add the main docs pages
refpack add https://advertising.amazon.com/API/docs/en-us/get-started/how-to-use-api
refpack add https://advertising.amazon.com/API/docs/en-us/concepts/authorization

# Add a sitemap if available
refpack add --sitemap https://advertising.amazon.com/sitemap.xml

# Add any PDFs you've downloaded
refpack add ./downloads/campaign-management-guide.pdf
refpack add ./downloads/reporting-best-practices.pdf

# Add your own notes
refpack add ./my-notes/

# Build
refpack build

# Check the result
refpack list
ls refs/
```

Now you have a single `refs/` folder with clean markdown from all those scattered sources, ready to drop into your RAG pipeline.

## Tips

- **Start small.** Add a few key pages first, build, and check the output quality before adding a whole sitemap.
- **Check the markdown.** Open a few files in `refs/` after building to make sure the HTML-to-markdown conversion captured the content you need. Some sites with heavy JavaScript rendering may not convert well.
- **Use sitemaps carefully.** A sitemap can contain hundreds of URLs. Start with individual pages to test, then switch to the sitemap when you're confident in the source quality.
- **Keep recipes in version control.** Commit `recipe.json` to your project repo so your team can rebuild the same reference pack.
- **Rebuild when docs update.** Run `refpack build` again to re-fetch and rebuild from all sources. (Automated change detection coming in a future version.)

## Command Reference

| Command | Description |
|---|---|
| `refpack init <name>` | Create a new refpack project directory |
| `refpack add <source>` | Add a URL, file, or directory as a source |
| `refpack add --sitemap <url>` | Add all URLs from a sitemap |
| `refpack build` | Fetch, clean, and build the reference pack |
| `refpack list` | Show all sources in the current pack |
| `refpack remove <source>` | Remove a source by its value |
| `refpack --help` | Show help |
| `refpack --version` | Show version |
