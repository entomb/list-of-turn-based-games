// Main pipeline orchestrator
// Runs extraction and enhancement steps in order

import { extractFromSteamSearch } from "./extract-steam-search.js"
import { extractFromTurnBasedLovers } from "./extract-turnbasedlovers.js"
import { steamStep } from "./step-steam.js"
import { metacriticStep } from "./step-metacritic.js"
import { loadGamesJson, saveGamesJson, exportToCsv } from "./utils.js"
import type { PipelineStep } from "./types.js"

// All enhancement steps in order
const ENHANCEMENT_STEPS: PipelineStep[] = [
  steamStep,
  metacriticStep,
  // Add new steps here as needed
]

interface PipelineOptions {
  skipExtract?: boolean
  skipEnhance?: boolean
  skipExport?: boolean
  onlyStep?: string // Run only a specific enhancement step
  steamSearchCount?: number
}

async function runPipeline(options: PipelineOptions = {}): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════")
  console.log("  Turn-Based Games Scraper Pipeline")
  console.log("═══════════════════════════════════════════════════════════════")

  const startTime = Date.now()

  // ============ EXTRACTION PHASE ============
  if (!options.skipExtract) {
    console.log("\n┌─────────────────────────────────────────────────────────────┐")
    console.log("│  PHASE 1: EXTRACTION                                        │")
    console.log("└─────────────────────────────────────────────────────────────┘")

    // Extract from Steam search
    await extractFromSteamSearch(options.steamSearchCount || 250)

    // Extract from Turn Based Lovers
    await extractFromTurnBasedLovers()

    const games = loadGamesJson()
    console.log(`\n📦 Total games after extraction: ${games.size}`)
  }

  // ============ ENHANCEMENT PHASE ============
  if (!options.skipEnhance) {
    console.log("\n┌─────────────────────────────────────────────────────────────┐")
    console.log("│  PHASE 2: ENHANCEMENT                                       │")
    console.log("└─────────────────────────────────────────────────────────────┘")

    const games = loadGamesJson()

    if (options.onlyStep) {
      // Run only the specified step
      const step = ENHANCEMENT_STEPS.find((s) => s.name === options.onlyStep)
      if (step) {
        await step.run(games)
      } else {
        console.log(`  Unknown step: ${options.onlyStep}`)
        console.log(`  Available steps: ${ENHANCEMENT_STEPS.map((s) => s.name).join(", ")}`)
      }
    } else {
      // Run all steps in order
      for (const step of ENHANCEMENT_STEPS) {
        await step.run(games)
      }
    }
  }

  // ============ EXPORT PHASE ============
  if (!options.skipExport) {
    console.log("\n┌─────────────────────────────────────────────────────────────┐")
    console.log("│  PHASE 3: EXPORT                                            │")
    console.log("└─────────────────────────────────────────────────────────────┘")

    const games = loadGamesJson()
    exportToCsv(games)

    // Print summary
    const total = games.size
    const steamOk = Array.from(games.values()).filter((g) => g.steps.steam.status === "success").length
    const metacriticOk = Array.from(games.values()).filter((g) => g.metacriticScore !== null).length

    console.log("\n📈 Pipeline Summary:")
    console.log(`   Total games: ${total}`)
    console.log(`   Steam data: ${steamOk} (${Math.round((steamOk / total) * 100)}%)`)
    console.log(`   Metacritic scores: ${metacriticOk} (${Math.round((metacriticOk / total) * 100)}%)`)
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n✅ Pipeline completed in ${elapsed} seconds`)
}

// Parse CLI arguments
function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2)
  const options: PipelineOptions = {}

  for (const arg of args) {
    if (arg === "--skip-extract") options.skipExtract = true
    if (arg === "--skip-enhance") options.skipEnhance = true
    if (arg === "--skip-export") options.skipExport = true
    if (arg.startsWith("--only-step=")) options.onlyStep = arg.split("=")[1]
    if (arg.startsWith("--steam-count=")) options.steamSearchCount = parseInt(arg.split("=")[1])
  }

  return options
}

// Print help
function printHelp(): void {
  console.log(`
Turn-Based Games Scraper Pipeline

Usage: npx tsx src/pipeline.ts [options]

Options:
  --skip-extract      Skip the extraction phase
  --skip-enhance      Skip the enhancement phase
  --skip-export       Skip the CSV export phase
  --only-step=NAME    Run only a specific enhancement step (steam, metacritic)
  --steam-count=N     Number of games to fetch from Steam search (default: 250)
  --help              Show this help

Examples:
  npx tsx src/pipeline.ts                    # Run full pipeline
  npx tsx src/pipeline.ts --skip-extract     # Re-run enhancement on existing data
  npx tsx src/pipeline.ts --only-step=steam  # Run only Steam enhancement
`)
}

// Main
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--help")) {
    printHelp()
  } else {
    runPipeline(parseArgs()).catch(console.error)
  }
}

export { runPipeline }
