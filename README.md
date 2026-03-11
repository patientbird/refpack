# refpack

Build shareable reference packs from web pages, PDFs, and local files.

## Install

```bash
npm install -g refpack
```

Or use directly with npx:

```bash
npx refpack init my-docs
```

## Usage

```bash
# Create a new refpack
refpack init amazon-advertising

# Add sources
cd amazon-advertising
refpack add https://advertising.amazon.com/API/docs
refpack add --sitemap https://advertising.amazon.com/sitemap.xml
refpack add ./local-notes.md
refpack add ./campaign-guide.pdf

# Build
refpack build

# Manage sources
refpack list
refpack remove https://advertising.amazon.com/API/docs
```

## Output

```
amazon-advertising/
├── refpack.json      # Manifest
├── recipe.json       # Shareable build recipe
└── refs/             # Clean markdown files
```

## Roadmap

- **v0.1** (current) — CLI tool, web/PDF/file sources, auto-discovery, concurrent fetching
- **v0.2** — IDE integrations: VS Code extension, Claude Code plugin (auto-load refpacks as context)
- **v0.3** — Registry: publish, install, and search shared recipes (`refpack install react-docs`)
- **v0.4** — Image support (`--include-images`): download charts/diagrams for vision-capable LLMs
- **Future** — GitHub source type, deduplication, pre-chunked output, change tracking

## License

MIT
