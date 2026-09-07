# MovieList

Modern Cinema Streaming and HD Media Platform

MovieList is an open-source, high-performance cinema web application designed for ultra-fast performance on broadband and BDIX (Bangladesh Internet Exchange) networks. It provides instant streaming for movies, television series, anime, and dramas with a glassmorphic user interface, built-in cinema player, smart multi-token search, and native external player support.

Live Site: [https://shahriyarshehab.github.io/movielist/](https://shahriyarshehab.github.io/movielist/)

GitHub Repository: [https://github.com/shahriyarshehab/movielist](https://github.com/shahriyarshehab/movielist)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture and Directory Structure](#architecture-and-directory-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation and Running](#installation-and-running)
  - [Server CLI Options](#server-cli-options)
- [Core Systems](#core-systems)
  - [Ultra-Fast Category Separation and Background Hydration](#ultra-fast-category-separation-and-background-hydration)
  - [Smart Relevance Search Engine](#smart-relevance-search-engine)
  - [TV Series Seasons and Episode Explorer](#tv-series-seasons-and-episode-explorer)
  - [Computer VLC Auto-Play and External Player Launchers](#computer-vlc-auto-play-and-external-player-launchers)
  - [Cinema Suite and Dynamic Ambilight Engine](#cinema-suite-and-dynamic-ambilight-engine)
  - [Mobile App Interface and Bottom Dock](#mobile-app-interface-and-bottom-dock)
- [Automation and Scraper Scripts](#automation-and-scraper-scripts)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Code Quality and Verification](#code-quality-and-verification)
- [License](#license)

---

## Overview

MovieList is engineered for instantaneous response times and zero-latency browsing across media catalogs exceeding 18,900 titles. Built using standard ES6+ JavaScript, custom glassmorphic CSS, and a Node.js development server, MovieList functions as both a responsive web application and an installable Progressive Web App (PWA).

Content is fetched directly from high-speed HTTP file nodes. The application separates initial home payloads into lightweight category slices for a 10-20ms first contentful paint, then streams complete background catalogs asynchronously without locking the main browser thread.

---

## Key Features

- Comprehensive Media Library: Over 18,900 titles indexed across Hollywood 1080p, Bollywood (Hindi), TV and Web Series, K-Drama, Animation and Anime, Bangla Cinema, South Indian Action, and 3D releases.
- Instant 10ms Home Boot: Independent category JSON architecture ensures immediate rendering of top releases on home page load.
- Smart Search and Relevance Ranking: Token-based fuzzy search with relevance scoring (exact match, prefix, substring, and token matches) and windowed DOM pagination to eliminate browser freezes.
- Complete TV Series Explorer: Multi-season tabs, episode counts, live episode search, direct episode streaming, season playlist export (.m3u), and download manager link export (.txt).
- In-Player Episode Navigation: Slide-out episode drawer and next/previous controls inside the cinema player with automatic playback advancement.
- Computer VLC Auto-Play: Direct native dispatch to VLC Media Player on desktop browsers via custom protocol handling.
- External Player Launchers: Deep-link integration for VLC Player, MX Player, and PotPlayer, along with M3U playlist file generation.
- Dynamic Ambilight Glow: Real-time canvas frame sampling providing responsive ambient edge lighting behind the video canvas.
- Mobile-First App Navigation: Fixed bottom dock, slide-up category drawer, expandable search bar, and bottom-sheet touch modals.
- Progressive Web App: Offline caching and instant asset delivery powered by a Stale-While-Revalidate service worker.

---

## Architecture and Directory Structure

```
movielist/
├── index.html              # Main Single Page Application interface
├── css/
│   └── movielist.css       # Glassmorphism design system, responsive styles, and animations
├── js/
│   ├── movielist.js        # Core application controller, player, search, and TV episode engine
│   └── lucide.min.js       # Lucide vector icon runtime library
├── server.js               # Node.js HTTP server with Range request seeking and SSE live reload
├── sw.js                   # Progressive Web App Service Worker (Stale-While-Revalidate)
├── package.json            # Scripts, dependencies, and project metadata
├── manifest.json           # Web App Manifest for mobile and desktop installation
├── tv_index.json           # Indexed TV series mapped with seasons and direct episode URLs
├── home_data.json          # Compiled home screen categories and carousel configuration
├── data/
│   ├── categories/         # Lightweight separated category files for fast first-paint
│   │   ├── today.json
│   │   ├── top_rated.json
│   │   ├── hollywood.json
│   │   ├── bollywood.json
│   │   ├── tv_series.json
│   │   ├── kdrama.json
│   │   ├── animation.json
│   │   └── bangla.json
│   ├── tv_series.json      # Complete TV directory (2,390+ series)
│   ├── hollywood.json      # Complete Hollywood directory (3,840+ movies)
│   ├── bollywood.json      # Complete Bollywood directory (3,710+ movies)
│   ├── kdrama.json         # Complete Korean drama directory
│   ├── animation.json      # Complete animation and anime directory
│   ├── bangla.json         # Complete Bangla movies directory
│   ├── south_action.json   # South Indian Hindi dubbed movies
│   ├── latest.json         # Latest release crawler feed
│   └── today.json          # Media items uploaded today
└── scripts/
    ├── auto_update.py      # Mother server scraper and category generator
    ├── crawl_tv_episodes.py# Recursive TV directory and episode crawler
    └── compress_tv_index.py# JSON index compression utility
```

---

## Getting Started

### Prerequisites

- Node.js (version 16.0 or higher recommended)
- Python 3 (optional, required only for running upstream crawler scripts)

### Installation and Running

Clone the repository and launch the development server:

```bash
# Clone repository
git clone https://github.com/shahriyarshehab/movielist.git
cd movielist

# Start local server
npm start

# Or start with browser auto-launch
npm run dev
```

The server binds to `http://localhost:3000` (automatically increments the port if 3000 is occupied).

### Server CLI Options

The server implementation (`server.js`) includes built-in command-line flags:

```bash
# Run on a custom port
node server.js --port 8080
# Or using shorthand:
node server.js -p 8080

# Auto-open default browser on start
node server.js --open
# Or using shorthand:
node server.js -o
```

---

## Core Systems

### Ultra-Fast Category Separation and Background Hydration

To eliminate initial payload bottlenecks, the home screen loads modular JSON files located in `data/categories/` in parallel. Each category file contains the first 16 releases, allowing the home interface to render in 10-20ms.

Once the initial interface is rendered, `loadFullLibraryInBackground()` asynchronously populates the complete 18,900+ title catalog in debounced background stages so that all movies and television series (such as Game of Thrones, Breaking Bad, and Stranger Things) are immediately searchable.

### Smart Relevance Search Engine

The search system is engineered to handle massive catalogs without UI thread freezing:

1. Token-Based Scoring: Search queries are tokenized and scored across candidate titles:
   - Exact title match: 1000 points
   - Prefix match: 800 points
   - Substring match: 600 points
   - Multi-word token coverage: 400+ points
2. DOM Windowing: Search and catalog grids render an initial batch of 48 cards (`GRID_PAGE_SIZE = 48`), keeping DOM node counts low and rendering times under 2ms.
3. Infinite Scroll: Additional results load automatically as the user scrolls near the bottom of the page, or via the manual "Load More" button.
4. Inline SVG Optimization: Card buttons use self-contained inline SVG markup, completely removing the overhead of runtime icon replacements on large lists.

### TV Series Seasons and Episode Explorer

Episodic media is cross-referenced with `tv_index.json`:

- Season Tabs: Horizontal navigation pills for Season 1 through Season N, plus Specials.
- Episode Directory: Each card displays episode index, cleaned title, quality tags, and one-click stream buttons.
- Season M3U Export: Generates an extended `.m3u` playlist containing all season episodes for media center playback.
- Links Export (.txt): Exports direct HTTP stream URLs for mass importing into download managers (IDM, 1DM, JDownloader).
- In-Player Episode Navigation: Video player features Previous Episode, Next Episode, and a slide-out episode drawer for jumping between episodes without exiting cinema view.
- Auto-Advance: When an episode finishes, playback automatically proceeds to the next episode.

### Computer VLC Auto-Play and External Player Launchers

For users who prefer native media playback:

- Desktop VLC Mode: Toggle the VLC button in the top navigation bar. When active, clicking "Play Movie" or any episode stream button on a desktop computer directly dispatches the stream to native VLC Media Player via the `vlc://${url}` protocol using a hidden iframe dispatcher.
- External Player Modal: Support for VLC, MX Player (`intent:` scheme for Android), and PotPlayer (`potplayer://`).
- Link Copying: Instant direct stream URL clipboard copying.

### Cinema Suite and Dynamic Ambilight Engine

- Dynamic Ambilight: Uses an off-screen HTML5 canvas element to sample active video frames and project a real-time glowing ambient backdrop behind the cinema player.
- Playback Memory: Remembers exact playback timestamps in localStorage with resume support.
- Speed Control: Quick playback rate adjustment from 0.5x to 2.0x.

### Mobile App Interface and Bottom Dock

- Fixed Navigation Dock: Quick navigation buttons for Home, Categories, Watchlist, Search, and Theme toggle pinned at the bottom of mobile screens.
- Category Bottom Sheet: Full-screen sliding drawer presenting all categories with titles and badges.
- Expandable Mobile Search: Header search toggle with instant clear and autofocus.
- Bottom Sheet Modals: Details, player settings, and external player modals slide up from the bottom with native-feeling touch handles.

---

## Automation and Scraper Scripts

The `scripts/` directory contains automation utilities:

- `scripts/auto_update.py`: Crawls upstream mother servers (172.16.50.x), categorizes releases, cleans release tags, generates `data/latest.json` and `data/today.json`, updates `home_data.json`, and outputs pre-split category files to `data/categories/`.
- `scripts/crawl_tv_episodes.py`: Traverses TV directories to map seasons and video files.
- `scripts/compress_tv_index.py`: Minifies television series directories into the compressed `tv_index.json` structure.

To execute a catalog update:

```bash
npm run update
# Or run directly:
python scripts/auto_update.py
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause video |
| `F` | Toggle fullscreen |
| `M` | Mute / Unmute audio |
| `←` / `→` | Seek backward / forward by 10 seconds |
| `N` | Play next episode (TV Series) |
| `P` | Play previous episode (TV Series) |
| `E` | Toggle in-player episode drawer |
| `Esc` | Close player, details modal, or active drawer |

---

## Code Quality and Verification

Defensive programming standards enforced across the project:

- DOM Sanitization: All dynamic data is escaped via `escapeHtml()`, `escapeQuotes()`, and `sanitizeUrl()` before insertion.
- Static Server Path Security: Node.js server validates relative file requests to prevent directory traversal attacks.
- Linter Verification: Run syntax verification before deployments:
  ```bash
  npm run lint
  ```

---

## License

This project is licensed under the MIT License. See `LICENSE` for details.
