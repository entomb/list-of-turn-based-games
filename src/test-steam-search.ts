// Test script for Steam search extraction
// Run: npx tsx src/test-steam-search.ts

import axios from "axios"
import * as cheerio from "cheerio"

const STEAM_SEARCH_BASE = "https://store.steampowered.com/search/results/"

async function testSteamSearch() {
  console.log("🧪 Testing Steam Search API...\n")

  const params = new URLSearchParams({
    sort_by: "Reviews_DESC",
    tags: "1666,9", // Card Game + Strategy
    supportedlang: "english",
    ndl: "1",
    count: "10",
    start: "0",
    infinite: "1",
  })

  const url = `${STEAM_SEARCH_BASE}?${params}`
  console.log(`URL: ${url}\n`)

  try {
    const response = await axios.get(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
    })

    console.log(`✅ Status: ${response.status}`)
    console.log(`Total count: ${response.data.total_count}`)

    const $ = cheerio.load(response.data.results_html)
    const games: { appid: number; name: string }[] = []

    $("a.search_result_row").each((_, el) => {
      const href = $(el).attr("href") || ""
      const appIdMatch = href.match(/\/app\/(\d+)/)
      const name = $(el).find(".title").text().trim()
      if (appIdMatch && name) {
        games.push({ appid: parseInt(appIdMatch[1]), name })
      }
    })

    console.log(`\nFound ${games.length} games:`)
    games.slice(0, 5).forEach((g) => console.log(`  - [${g.appid}] ${g.name}`))
    if (games.length > 5) console.log(`  ... and ${games.length - 5} more`)

    return true
  } catch (error: any) {
    console.log(`❌ Error: ${error.response?.status || error.message}`)
    if (error.response) {
      console.log(`Response headers:`, error.response.headers)
    }
    return false
  }
}

testSteamSearch()
