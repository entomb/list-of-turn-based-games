// Extract games from Turn Based Lovers lists page
// Source: https://turnbasedlovers.com/-/lists/

import axios from "axios"
import * as cheerio from "cheerio"
import { loadGamesJson, saveGamesJson, createGameEntry, delay } from "./utils.js"
import { getBrowserHeaders } from "./user-agents.js"

const LISTS_URL = "https://turnbasedlovers.com/-/lists/"

interface TblGame {
  name: string
  steamAppId: number | null
  pageUrl: string
}

// Fetch all list links from the main lists page
async function fetchListLinks(): Promise<string[]> {
  console.log("  Fetching lists from turnbasedlovers.com...")

  const response = await axios.get(LISTS_URL, {
    headers: getBrowserHeaders(),
    timeout: 15000,
  })

  const $ = cheerio.load(response.data)
  const links: string[] = []

  // Find all list links
  $('a[href*="/lists/"]').each((_, el) => {
    const href = $(el).attr("href")
    if (href && href.includes("/lists/") && !href.endsWith("/lists/")) {
      const fullUrl = href.startsWith("http") ? href : `https://turnbasedlovers.com${href}`
      if (!links.includes(fullUrl)) {
        links.push(fullUrl)
      }
    }
  })

  console.log(`  Found ${links.length} list pages`)
  return links
}

// Extract games from a single list page
async function extractGamesFromList(listUrl: string): Promise<TblGame[]> {
  try {
    const response = await axios.get(listUrl, {
      headers: getBrowserHeaders(LISTS_URL),
      timeout: 15000,
    })

    const $ = cheerio.load(response.data)
    const games: TblGame[] = []

    // Look for Steam links to extract app IDs
    $('a[href*="store.steampowered.com/app/"]').each((_, el) => {
      const href = $(el).attr("href") || ""
      const match = href.match(/store\.steampowered\.com\/app\/(\d+)/)
      if (match) {
        const steamAppId = parseInt(match[1])
        // Try to find the game name nearby
        const $parent = $(el).closest("article, .game-item, .entry, div")
        let name = $parent.find("h2, h3, h4, .title, .name").first().text().trim()

        if (!name) {
          name = $(el).text().trim() || `Steam App ${steamAppId}`
        }

        // Avoid duplicates within the same list
        if (!games.some((g) => g.steamAppId === steamAppId)) {
          games.push({
            name,
            steamAppId,
            pageUrl: listUrl,
          })
        }
      }
    })

    // Also look for game titles that might have Steam IDs in data attributes
    $("[data-steam-id], [data-appid]").each((_, el) => {
      const $el = $(el)
      const steamAppId = parseInt($el.attr("data-steam-id") || $el.attr("data-appid") || "0")
      if (steamAppId > 0) {
        const name = $el.find(".title, .name, h2, h3").first().text().trim() || $el.text().trim()
        if (name && !games.some((g) => g.steamAppId === steamAppId)) {
          games.push({
            name: name.slice(0, 100),
            steamAppId,
            pageUrl: listUrl,
          })
        }
      }
    })

    return games
  } catch (error) {
    console.log(`  Warning: Failed to fetch ${listUrl}`)
    return []
  }
}

export async function extractFromTurnBasedLovers(): Promise<number> {
  console.log("\n📋 Extracting games from Turn Based Lovers lists...")

  const games = loadGamesJson()
  const initialCount = games.size

  // Get all list links
  const listLinks = await fetchListLinks()

  // Extract games from each list
  for (let i = 0; i < listLinks.length; i++) {
    const listUrl = listLinks[i]
    console.log(`  Processing list ${i + 1}/${listLinks.length}: ${listUrl.split("/").pop()}`)

    const listGames = await extractGamesFromList(listUrl)

    for (const tblGame of listGames) {
      if (tblGame.steamAppId && !games.has(tblGame.steamAppId)) {
        const game = createGameEntry(tblGame.steamAppId, tblGame.name, "turnbasedlovers")
        games.set(tblGame.steamAppId, game)
      } else if (tblGame.steamAppId && games.has(tblGame.steamAppId)) {
        // Add source if not already present
        const existing = games.get(tblGame.steamAppId)!
        if (!existing.sources.includes("turnbasedlovers")) {
          existing.sources.push("turnbasedlovers")
        }
      }
    }

    // Rate limiting
    await delay(500)
  }

  saveGamesJson(games)
  const newCount = games.size - initialCount
  console.log(`✓ Turn Based Lovers extraction complete. Added ${newCount} new games.`)

  return newCount
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  extractFromTurnBasedLovers().catch(console.error)
}
