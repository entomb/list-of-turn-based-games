// Step: Enhance games with Metacritic scores
// Uses Steam's metacritic data if available, or searches Metacritic directly

import axios from "axios"
import * as cheerio from "cheerio"
import type { GameDetails, PipelineStep } from "./types.js"
import { loadGamesJson, saveGamesJson, stepSuccess, stepFailed, stepSkipped, delay } from "./utils.js"
import { getBrowserHeaders } from "./user-agents.js"

// Metacritic search URL
const METACRITIC_SEARCH = "https://www.metacritic.com/search/"

interface MetacriticResult {
  score: number | null
  url: string | null
}

// Clean game name for search
function cleanNameForSearch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // remove special chars
    .replace(/\s+/g, " ")
    .trim()
}

// Try to find Metacritic score by searching
async function searchMetacritic(gameName: string): Promise<MetacriticResult> {
  try {
    const searchQuery = cleanNameForSearch(gameName)
    const url = `${METACRITIC_SEARCH}${encodeURIComponent(searchQuery)}/?page=1&category=13` // category 13 = games

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      timeout: 15000,
    })

    const $ = cheerio.load(response.data)

    // Look for first game result with a score
    const firstResult = $('a[href*="/game/"]').first()
    if (firstResult.length === 0) {
      return { score: null, url: null }
    }

    const href = firstResult.attr("href")
    const gameUrl = href?.startsWith("http") ? href : `https://www.metacritic.com${href}`

    // Look for metascore near the result
    const scoreEl = firstResult.find(".c-siteReviewScore, .metascore_w").first()
    let score: number | null = null

    if (scoreEl.length > 0) {
      const scoreText = scoreEl.text().trim()
      const parsed = parseInt(scoreText)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        score = parsed
      }
    }

    return { score, url: gameUrl }
  } catch (error) {
    return { score: null, url: null }
  }
}

// Fetch score from a specific Metacritic game page
async function fetchMetacriticPage(url: string): Promise<number | null> {
  try {
    const response = await axios.get(url, {
      headers: getBrowserHeaders("https://www.metacritic.com/"),
      timeout: 15000,
    })

    const $ = cheerio.load(response.data)

    // Try various selectors for the metascore
    const scoreSelectors = [
      "span[data-v-4cdca868].c-siteReviewScore_medium span",
      ".c-productScoreInfo_scoreNumber",
      ".c-siteReviewScore span",
      ".metascore_w.xlarge",
      ".metascore_w.large",
      'div[class*="metascore"] span',
    ]

    for (const selector of scoreSelectors) {
      const el = $(selector).first()
      if (el.length > 0) {
        const text = el.text().trim()
        const parsed = parseInt(text)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          return parsed
        }
      }
    }

    return null
  } catch {
    return null
  }
}

async function enhanceWithMetacritic(game: GameDetails): Promise<void> {
  // Skip if we already have a metacritic score from Steam
  if (game.metacriticScore !== null && game.metacriticUrl !== null) {
    game.steps.metacritic = stepSkipped("Already have score from Steam")
    return
  }

  // If we have a URL from Steam but no score, try to fetch it
  if (game.metacriticUrl && !game.metacriticScore) {
    const score = await fetchMetacriticPage(game.metacriticUrl)
    if (score !== null) {
      game.metacriticScore = score
      game.steps.metacritic = stepSuccess()
      return
    }
  }

  // Search Metacritic for this game
  const result = await searchMetacritic(game.name)

  if (result.score !== null) {
    game.metacriticScore = result.score
    game.metacriticUrl = result.url
    game.steps.metacritic = stepSuccess()
  } else if (result.url) {
    // We found a page but no score in search, try fetching the page
    await delay(500)
    const score = await fetchMetacriticPage(result.url)
    if (score !== null) {
      game.metacriticScore = score
      game.metacriticUrl = result.url
      game.steps.metacritic = stepSuccess()
    } else {
      game.metacriticUrl = result.url
      game.steps.metacritic = stepSkipped("Found page but no score")
    }
  } else {
    game.steps.metacritic = stepSkipped("Not found on Metacritic")
  }
}

export const metacriticStep: PipelineStep = {
  name: "metacritic",

  async run(games: Map<number, GameDetails>): Promise<void> {
    console.log("\n📊 Running Metacritic enhancement step...")

    // Only process games that completed Steam step and don't have Metacritic done
    const pending = Array.from(games.values()).filter(
      (g) => g.steps.steam.status === "success" && g.steps.metacritic.status === "pending"
    )

    console.log(`  ${pending.length} games pending Metacritic enhancement`)

    let processed = 0
    let found = 0
    let notFound = 0

    for (const game of pending) {
      process.stdout.write(`\r  Processing ${processed + 1}/${pending.length}: ${game.name.slice(0, 40)}...`)

      try {
        await enhanceWithMetacritic(game)

        if (game.metacriticScore !== null) {
          found++
        } else {
          notFound++
        }
      } catch (error) {
        game.steps.metacritic = stepFailed(error instanceof Error ? error.message : "Unknown error")
        notFound++
      }

      processed++

      // Save progress every 10 games
      if (processed % 10 === 0) {
        saveGamesJson(games)
      }

      // Rate limiting - be nice to Metacritic
      await delay(2000)
    }

    console.log(`\n✓ Metacritic step complete: ${found} found, ${notFound} not found/skipped`)
    saveGamesJson(games)
  },
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const games = loadGamesJson()
  metacriticStep.run(games).catch(console.error)
}
