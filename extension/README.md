# refpack Browser Extension

A Chrome/Firefox extension companion to the [refpack CLI](../README.md). Convert web pages to clean markdown and save groups of related pages — right from your browser.

## Features

### Page
- **Copy** — Copy the current page as clean markdown to your clipboard
- **Save .md** — Save the current page as a markdown file

### Group Save
- **Automatic discovery** — Detects all related child pages under the current URL path
- **Save .md** — Bundle all pages into a single markdown file
- **Save .zip** — Save each page as an individual `.md` file in a zip archive
- **Pause/Resume** — Pause fetching and resume where you left off
- **Cancel** — Stop with confirmation to prevent accidental data loss
- **Background fetching** — Tab away during a fetch; progress continues in the background
- **Live progress** — Real-time counter, progress bar, and status dot on the active button

### llms.txt Detection
- Checks if the current site publishes an [llms.txt](https://llmstxt.org/) file
- Copy or save the llms.txt content when detected

### Status Indicators
The extension icon shows a glowing status dot:
- **Teal** — Actively fetching pages
- **Yellow** — Paused
- **Green** — Complete (auto-clears after 5s)
- **Red** — Error (auto-clears after 5s)

## Install (Development)

1. Clone the repo and navigate to the extension:
   ```bash
   git clone https://github.com/patientbird/refpack.git
   cd refpack/extension
   ```

2. **Chrome**: Go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", select the `extension/` folder

3. **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select `extension/manifest.json`

## How It Works

- **Page conversion** uses a content script injected into the active tab. It clones the DOM, strips boilerplate (nav, footer, sidebar, scripts), and converts the remaining content to markdown using native DOM APIs.

- **Group discovery** extracts all same-origin links on the current page that share the current URL path prefix. For example, on `/docs`, it finds all links under `/docs/*`.

- **Group fetching** runs in the service worker so it persists if the popup closes. The popup communicates via `chrome.runtime.connect` ports for real-time progress. HTML-to-markdown conversion happens in the popup (needs DOMParser) when fetching completes.

## Tech Stack

- Chrome Manifest V3 / Firefox WebExtensions
- Vanilla JS (no build step, no framework)
- [JSZip](https://stuk.github.io/jszip/) for zip generation
- Custom HTML-to-markdown converter (ported from the CLI's Cheerio-based cleaner)

## File Structure

```
extension/
├── manifest.json
├── background/
│   └── service-worker.js    # Badge, llms.txt, group fetch engine
├── content/
│   └── content.js           # DOM-to-markdown converter
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js             # UI, progress, download handling
├── lib/
│   └── jszip.min.js
└── icons/
    ├── icon-{16,32,48,128}.png          # Default icons
    └── icon-{16,32,48,128}-{color}.png  # Status dot variants
```

## License

MIT
