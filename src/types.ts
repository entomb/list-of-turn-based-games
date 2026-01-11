// Pipeline types for turn-based game scraper

export interface GameSource {
  name: string
  steamAppId: number | null
  source: "turnbasedlovers" | "steam-search"
  sourceUrl?: string
}

// Step status for modular pipeline tracking
export type StepStatus = "pending" | "success" | "failed" | "skipped"

export interface StepResult {
  status: StepStatus
  completedAt: string | null
  error: string | null
}

export interface GameDetails {
  // Identifiers
  steamAppId: number
  name: string

  // Basic info (from Steam)
  developer: string | null
  publisher: string | null
  releaseDate: string | null
  releaseYear: number | null

  // Descriptions
  shortDescription: string | null
  detailedDescription: string | null
  aboutTheGame: string | null

  // Tags and categories
  tags: string[]
  genres: string[]
  categories: string[]

  // Steam Reviews
  reviewScore: number | null // 0-100
  reviewScoreDesc: string | null // "Very Positive", etc.
  totalReviews: number | null
  totalPositive: number | null
  totalNegative: number | null

  // Metacritic
  metacriticScore: number | null
  metacriticUrl: string | null

  // Media
  headerImage: string | null
  screenshots: string[]

  // Price
  isFree: boolean
  priceFormatted: string | null

  // Pipeline tracking
  sources: string[] // Which sources found this game
  extractedAt: string

  // Modular step tracking - each step records its own status
  steps: {
    steam: StepResult
    metacritic: StepResult
  }
}

export interface PipelineState {
  games: Map<number, GameDetails> // keyed by steamAppId
  lastUpdated: string
}

// CSV row format for export
export interface GameCsvRow {
  steam_app_id: number
  name: string
  developer: string
  publisher: string
  release_date: string
  release_year: string
  short_description: string
  about_the_game: string
  tags: string
  genres: string
  categories: string
  review_score: string
  review_score_desc: string
  total_reviews: string
  positive_reviews: string
  negative_reviews: string
  metacritic_score: string
  metacritic_url: string
  header_image: string
  screenshots: string
  is_free: string
  price: string
  sources: string
  extracted_at: string
  step_steam: string
  step_metacritic: string
}

// Pipeline step interface - all enhancement steps implement this
export interface PipelineStep {
  name: string
  run(games: Map<number, GameDetails>): Promise<void>
}
