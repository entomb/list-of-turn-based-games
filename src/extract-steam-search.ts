// Extract games from Steam search results
// Source: https://store.steampowered.com/search with various tag combinations

import axios from "axios"
import * as cheerio from "cheerio"
import type { GameDetails } from "./types.js"
import { loadGamesJson, saveGamesJson, createGameEntry, delay } from "./utils.js"
import { getApiHeaders } from "./user-agents.js"

const STEAM_SEARCH_BASE = "https://store.steampowered.com/search/results/"

// Tag IDs reference:
// 9 = Strategy, 1666 = Card Game, 14139 = Turn-Based
// 4325 = Turn-Based Strategy, 17389 = Deckbuilding, 1677 = Turn-Based Tactics

// Multiple search configurations - each will be searched
const SEARCH_CONFIGS = [
  { tags: "1666,9", name: "Card Game + Strategy", target: 150 },
  { tags: "14139,1666", name: "Turn-Based + Card Game", target: 150 },
  { tags: "4325,1666", name: "Turn-Based Strategy + Card Game", target: 100 },
]

interface SteamSearchResult {
  appid: number
  name: string
}

async function fetchSearchPage(
  tags: string,
  start: number
): Promise<{ results: SteamSearchResult[]; totalCount: number }> {
  const params = new URLSearchParams({
    sort_by: "Reviews_DESC",
    tags: tags,
    supportedlang: "english",
    ndl: "1",
    count: "50",
    start: start.toString(),
    infinite: "1",
  })

  const url = `${STEAM_SEARCH_BASE}?${params}`
  console.log(`    Fetching page starting at ${start}...`)

  const response = await axios.get(url, {
    headers: getApiHeaders(),
    timeout: 15000,
  })

  const data = response.data
  const $ = cheerio.load(data.results_html)

  const results: SteamSearchResult[] = []

  $("a.search_result_row").each((_, el) => {
    const $el = $(el)
    const href = $el.attr("href") || ""
    const appIdMatch = href.match(/\/app\/(\d+)/)
    const name = $el.find(".title").text().trim()

    if (appIdMatch && name) {
      results.push({
        appid: parseInt(appIdMatch[1]),
        name,
      })
    }
  })

  return {
    results,
    totalCount: data.total_count || 0,
  }
}

async function searchByTags(
  games: Map<number, GameDetails>,
  tags: string,
  name: string,
  targetCount: number
): Promise<number> {
  console.log(`\n  🔍 Searching: ${name} (tags: ${tags})`)

  let newCount = 0
  let start = 0

  while (newCount < targetCount) {
    const { results, totalCount } = await fetchSearchPage(tags, start)

    if (results.length === 0) {
      console.log(`    No more results`)
      break
    }

    for (const result of results) {
      if (!games.has(result.appid)) {
        const game = createGameEntry(result.appid, result.name, `steam:${tags}`)
        games.set(result.appid, game)
        newCount++
      } else {
        const existing = games.get(result.appid)!
        const source = `steam:${tags}`
        if (!existing.sources.includes(source)) {
          existing.sources.push(source)
        }
      }
    }

    console.log(`    Found ${results.length} games (${newCount} new this search, ${games.size} total)`)

    start += results.length

    if (start >= totalCount) {
      console.log(`    Reached end (${totalCount} total available)`)
      break
    }

    await delay(1000)
  }

  return newCount
}

export async function extractFromSteamSearch(): Promise<number> {
  console.log("\n🎮 Extracting games from Steam searches...")

  const games = loadGamesJson()
  const initialCount = games.size
  let totalNew = 0

  for (const config of SEARCH_CONFIGS) {
    const newFromSearch = await searchByTags(games, config.tags, config.name, config.target)
    totalNew += newFromSearch

    // Save after each search type
    saveGamesJson(games)

    // Delay between different searches
    await delay(2000)
  }

  console.log(`\n✓ Steam extraction complete. Added ${games.size - initialCount} new games (${games.size} total).`)

  return games.size - initialCount
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  extractFromSteamSearch().catch(console.error)
}
