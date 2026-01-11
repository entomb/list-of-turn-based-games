// Utility functions for the pipeline

import * as fs from "fs"
import * as path from "path"
import type { GameDetails, GameCsvRow, StepResult } from "./types.js"

const OUTPUT_DIR = path.join(process.cwd(), "output")

export function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

export function getOutputPath(filename: string): string {
  return path.join(OUTPUT_DIR, filename)
}

// Load games from JSON intermediate file
export function loadGamesJson(): Map<number, GameDetails> {
  const filePath = getOutputPath("games.json")
  if (!fs.existsSync(filePath)) {
    return new Map()
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"))
  return new Map(Object.entries(data).map(([k, v]) => [parseInt(k), v as GameDetails]))
}

// Save games to JSON intermediate file
export function saveGamesJson(games: Map<number, GameDetails>): void {
  ensureOutputDir()
  const filePath = getOutputPath("games.json")
  const obj = Object.fromEntries(games)
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2))
}

// ============ Step Result Helpers ============

export function defaultStepResult(): StepResult {
  return {
    status: "pending",
    completedAt: null,
    error: null,
  }
}

export function stepSuccess(): StepResult {
  return {
    status: "success",
    completedAt: new Date().toISOString(),
    error: null,
  }
}

export function stepFailed(error: string): StepResult {
  return {
    status: "failed",
    completedAt: new Date().toISOString(),
    error,
  }
}

export function stepSkipped(reason: string): StepResult {
  return {
    status: "skipped",
    completedAt: new Date().toISOString(),
    error: reason,
  }
}

// ============ CSV Export ============

// Convert game to CSV row
export function gameToCsvRow(game: GameDetails): GameCsvRow {
  return {
    steam_app_id: game.steamAppId,
    name: game.name,
    developer: game.developer || "",
    publisher: game.publisher || "",
    release_date: game.releaseDate || "",
    release_year: game.releaseYear?.toString() || "",
    short_description: game.shortDescription || "",
    about_the_game: cleanTextForCsv(game.aboutTheGame || ""),
    tags: game.tags.join("; "),
    genres: game.genres.join("; "),
    categories: game.categories.join("; "),
    review_score: game.reviewScore?.toString() || "",
    review_score_desc: game.reviewScoreDesc || "",
    total_reviews: game.totalReviews?.toString() || "",
    positive_reviews: game.totalPositive?.toString() || "",
    negative_reviews: game.totalNegative?.toString() || "",
    metacritic_score: game.metacriticScore?.toString() || "",
    metacritic_url: game.metacriticUrl || "",
    header_image: game.headerImage || "",
    screenshots: game.screenshots.slice(0, 3).join("; "),
    is_free: game.isFree ? "true" : "false",
    price: game.priceFormatted || "",
    sources: game.sources.join("; "),
    extracted_at: game.extractedAt,
    step_steam: game.steps.steam.status,
    step_metacritic: game.steps.metacritic.status,
  }
}

// Clean text for CSV (remove newlines, excessive whitespace)
function cleanTextForCsv(text: string): string {
  return text
    .replace(/<[^>]*>/g, "") // remove HTML tags
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500) // limit length
}

// Export games to CSV
export function exportToCsv(games: Map<number, GameDetails>): void {
  ensureOutputDir()
  const filePath = getOutputPath("games.csv")

  const headers: (keyof GameCsvRow)[] = [
    "steam_app_id",
    "name",
    "developer",
    "publisher",
    "release_date",
    "release_year",
    "short_description",
    "about_the_game",
    "tags",
    "genres",
    "categories",
    "review_score",
    "review_score_desc",
    "total_reviews",
    "positive_reviews",
    "negative_reviews",
    "metacritic_score",
    "metacritic_url",
    "header_image",
    "screenshots",
    "is_free",
    "price",
    "sources",
    "extracted_at",
    "step_steam",
    "step_metacritic",
  ]

  // Include games where Steam step succeeded (have basic info)
  const rows = Array.from(games.values())
    .filter((g) => g.steps.steam.status === "success")
    .sort((a, b) => (b.totalReviews || 0) - (a.totalReviews || 0))
    .map(gameToCsvRow)

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvField(row[h])).join(",")),
  ].join("\n")

  fs.writeFileSync(filePath, csvContent)
  console.log(`✓ Exported ${rows.length} games to ${filePath}`)
}

function escapeCsvField(value: string | number): string {
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// ============ Misc Helpers ============

// Rate limiting helper
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Create a new game entry with defaults
export function createGameEntry(steamAppId: number, name: string, source: string): GameDetails {
  return {
    steamAppId,
    name,
    developer: null,
    publisher: null,
    releaseDate: null,
    releaseYear: null,
    shortDescription: null,
    detailedDescription: null,
    aboutTheGame: null,
    tags: [],
    genres: [],
    categories: [],
    reviewScore: null,
    reviewScoreDesc: null,
    totalReviews: null,
    totalPositive: null,
    totalNegative: null,
    metacriticScore: null,
    metacriticUrl: null,
    headerImage: null,
    screenshots: [],
    isFree: false,
    priceFormatted: null,
    sources: [source],
    extractedAt: new Date().toISOString(),
    steps: {
      steam: defaultStepResult(),
      metacritic: defaultStepResult(),
    },
  }
}
