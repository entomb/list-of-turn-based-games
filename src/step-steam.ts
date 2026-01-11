// Step: Enhance games with Steam API data
// Fetches: descriptions, tags, genres, reviews, images, publisher, etc.

import axios from "axios"
import type { GameDetails, PipelineStep } from "./types.js"
import { loadGamesJson, saveGamesJson, stepSuccess, stepFailed, stepSkipped, delay } from "./utils.js"
import { getApiHeaders, getSteamHeaders } from "./user-agents.js"

const STEAM_API_BASE = "https://store.steampowered.com/api/appdetails"
const STEAM_REVIEWS_API = "https://store.steampowered.com/appreviews"

interface SteamAppDetails {
  success: boolean
  data?: {
    name: string
    steam_appid: number
    is_free: boolean
    short_description: string
    detailed_description: string
    about_the_game: string
    header_image: string
    developers?: string[]
    publishers?: string[]
    price_overview?: {
      final_formatted: string
    }
    release_date?: {
      coming_soon: boolean
      date: string
    }
    genres?: Array<{ id: string; description: string }>
    categories?: Array<{ id: number; description: string }>
    screenshots?: Array<{ path_thumbnail: string; path_full: string }>
    metacritic?: {
      score: number
      url: string
    }
  }
}

interface SteamReviewsResponse {
  success: number
  query_summary?: {
    review_score: number
    review_score_desc: string
    total_positive: number
    total_negative: number
    total_reviews: number
  }
}

async function fetchSteamDetails(appId: number): Promise<SteamAppDetails | null> {
  try {
    const response = await axios.get<Record<string, SteamAppDetails>>(STEAM_API_BASE, {
      params: { appids: appId, l: "english" },
      headers: getApiHeaders(),
      timeout: 15000,
    })
    return response.data[appId.toString()] || null
  } catch (error) {
    return null
  }
}

async function fetchSteamReviews(appId: number): Promise<SteamReviewsResponse | null> {
  try {
    const response = await axios.get<SteamReviewsResponse>(`${STEAM_REVIEWS_API}/${appId}`, {
      params: { json: 1, language: "all", purchase_type: "all" },
      headers: getApiHeaders(),
      timeout: 15000,
    })
    return response.data
  } catch (error) {
    return null
  }
}

// Extract year from release date string
function extractYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  const match = dateStr.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0]) : null
}

async function enhanceGame(game: GameDetails): Promise<void> {
  // Fetch app details
  const details = await fetchSteamDetails(game.steamAppId)

  if (!details || !details.success || !details.data) {
    game.steps.steam = stepFailed("App not found or API error")
    return
  }

  const data = details.data

  // Basic info
  game.name = data.name || game.name
  game.developer = data.developers?.[0] || null
  game.publisher = data.publishers?.[0] || null
  game.releaseDate = data.release_date?.date || null
  game.releaseYear = extractYear(data.release_date?.date)

  // Descriptions
  game.shortDescription = data.short_description || null
  game.detailedDescription = data.detailed_description || null
  game.aboutTheGame = data.about_the_game || null

  // Categories and genres
  game.genres = data.genres?.map((g) => g.description) || []
  game.categories = data.categories?.map((c) => c.description) || []

  // Media
  game.headerImage = data.header_image || null
  game.screenshots = data.screenshots?.map((s) => s.path_full) || []

  // Price
  game.isFree = data.is_free
  game.priceFormatted = data.price_overview?.final_formatted || (data.is_free ? "Free" : null)

  // Metacritic from Steam API (bonus - may be available)
  if (data.metacritic) {
    game.metacriticScore = data.metacritic.score
    game.metacriticUrl = data.metacritic.url
  }

  // Fetch reviews separately
  await delay(300) // Rate limit between calls
  const reviews = await fetchSteamReviews(game.steamAppId)

  if (reviews?.success && reviews.query_summary) {
    const qs = reviews.query_summary
    game.reviewScore = qs.review_score * 10 // Convert 0-10 to 0-100 scale
    game.reviewScoreDesc = qs.review_score_desc
    game.totalReviews = qs.total_reviews
    game.totalPositive = qs.total_positive
    game.totalNegative = qs.total_negative
  }

  game.steps.steam = stepSuccess()
}

// Fetch Steam tags from the store page (not available in API)
async function fetchSteamTags(appId: number): Promise<string[]> {
  try {
    const response = await axios.get(`https://store.steampowered.com/app/${appId}`, {
      headers: getSteamHeaders(),
      timeout: 15000,
    })

    const html = response.data
    const tagMatch = html.match(/InitAppTagModal\([^,]+,\s*(\[[^\]]+\])/s)
    if (tagMatch) {
      try {
        const tags = JSON.parse(tagMatch[1])
        return tags.map((t: { name: string }) => t.name).slice(0, 15)
      } catch {
        return []
      }
    }
    return []
  } catch {
    return []
  }
}

export const steamStep: PipelineStep = {
  name: "steam",

  async run(games: Map<number, GameDetails>): Promise<void> {
    console.log("\n🔧 Running Steam enhancement step...")

    const pending = Array.from(games.values()).filter((g) => g.steps.steam.status === "pending")

    console.log(`  ${pending.length} games pending Steam enhancement`)

    let processed = 0
    let success = 0
    let failed = 0

    for (const game of pending) {
      process.stdout.write(`\r  Processing ${processed + 1}/${pending.length}: ${game.name.slice(0, 40)}...`)

      try {
        await enhanceGame(game)

        // Also fetch tags from store page
        const tags = await fetchSteamTags(game.steamAppId)
        if (tags.length > 0) {
          game.tags = tags
        }

        // Filter: Must have card-related tags
        const hasCardTag = game.tags?.some(
          (tag) => tag.toLowerCase().includes("card") || tag.toLowerCase().includes("deckbuilding")
        )

        if (!hasCardTag) {
          game.steps.steam = stepSkipped("Not a card/deckbuilding game")
          failed++
        } else if (game.steps.steam.status === "success") {
          success++
        } else {
          failed++
        }
      } catch (error) {
        game.steps.steam = stepFailed(error instanceof Error ? error.message : "Unknown error")
        failed++
      }

      processed++

      // Save progress every 10 games
      if (processed % 10 === 0) {
        saveGamesJson(games)
      }

      // Rate limiting - Steam API is strict
      await delay(1500)
    }

    console.log(`\n✓ Steam step complete: ${success} succeeded, ${failed} failed`)
    saveGamesJson(games)
  },
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const games = loadGamesJson()
  steamStep.run(games).catch(console.error)
}
