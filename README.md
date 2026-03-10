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

## License

MIT
