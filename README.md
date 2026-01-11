# Turn-Based Game Scraper

A pipeline scraper that collects turn-based card games from Steam and other sources, enriches them with metadata, and provides a browsable web viewer.

## 🎮 Live Viewer

**[Browse the Games Database →](https://entomb.github.io/list-of-turn-based-games/)**

## Features

- **Multi-source extraction**: Scrapes games from Steam search (multiple tag combinations) and TurnBasedLovers.com
- **Rich metadata**: Fetches descriptions, tags, reviews, screenshots, release dates from Steam API
- **Metacritic integration**: Retrieves Metacritic scores where available
- **Resumable pipeline**: Progress is saved per-game, so you can run in chunks
- **CSV export**: Export all data to CSV for analysis
- **Web viewer**: Single-file HTML viewer with search, filtering, and sorting

## Steam Tag Searches

The scraper searches for games matching these tag combinations:

- Card Game + Strategy
- Turn-Based + Card Game
- Turn-Based Strategy + Card Game

## Usage

### Run the full pipeline

```bash
npm run pipeline
```

### Run individual steps

```bash
# Extract games from all sources
npm run extract:steam
npm run extract:tbl

# Enhance with Steam data
npm run step:steam

# Enhance with Metacritic scores
npm run step:metacritic

# Export to CSV
npm run pipeline:export
```

### View the data

```bash
npm run viewer
# Opens at http://localhost:3000
```

## Output

- `output/games.json` - Full game database with all metadata
- `output/games.csv` - CSV export for spreadsheet analysis
- `output/index.html` - Self-contained web viewer

## Tech Stack

- TypeScript with tsx runner
- axios for HTTP requests
- cheerio for HTML parsing
- Tailwind CSS (CDN) for the viewer

## License

MIT
