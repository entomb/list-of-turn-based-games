// Test script for Turn Based Lovers extraction
// Run: npx tsx src/test-tbl.ts

import axios from "axios"
import * as cheerio from "cheerio"
import { getBrowserHeaders } from "./user-agents.js"

const LISTS_URL = "https://turnbasedlovers.com/-/lists/"

async function testTurnBasedLovers() {
  console.log("🧪 Testing Turn Based Lovers...\n")
  console.log(`URL: ${LISTS_URL}\n`)

  console.log("Using full browser headers...")
  try {
    const response = await axios.get(LISTS_URL, {
      headers: getBrowserHeaders(),
      timeout: 15000,
    })

    console.log(`✅ Status: ${response.status}`)
    console.log(`Content length: ${response.data.length} bytes`)

    const $ = cheerio.load(response.data)
    const links: string[] = []

    $('a[href*="/lists/"]').each((_, el) => {
      const href = $(el).attr("href")
      if (href && href.includes("/lists/") && !href.endsWith("/lists/")) {
        const fullUrl = href.startsWith("http") ? href : `https://turnbasedlovers.com${href}`
        if (!links.includes(fullUrl)) {
          links.push(fullUrl)
        }
      }
    })

    console.log(`\nFound ${links.length} list pages:`)
    if (links.length > 0) {
      links.slice(0, 5).forEach((l) => console.log(`  - ${l}`))
      if (links.length > 5) console.log(`  ... and ${links.length - 5} more`)

      // Test one list page
      console.log(`\n--- Testing first list ---`)
      await testListPage(links[0])
    }
    return true
  } catch (error: any) {
    console.log(`❌ Error: ${error.response?.status || error.message}`)
    if (error.response?.status === 403) {
      console.log(`\n⚠️  403 Forbidden - Site is blocking the request`)
      console.log(`Headers used:`, getBrowserHeaders())
    }
    return false
  }
}

async function testListPage(url: string) {
  try {
    const response = await axios.get(url, {
      headers: getBrowserHeaders(LISTS_URL),
      timeout: 15000,
    })

    console.log(`✅ Status: ${response.status}`)

    const $ = cheerio.load(response.data)
    const games: { name: string; steamAppId: number }[] = []

    $('a[href*="store.steampowered.com/app/"]').each((_, el) => {
      const href = $(el).attr("href") || ""
      const match = href.match(/store\.steampowered\.com\/app\/(\d+)/)
      if (match) {
        const steamAppId = parseInt(match[1])
        const $parent = $(el).closest("article, .game-item, .entry, div")
        let name = $parent.find("h2, h3, h4, .title, .name").first().text().trim()
        if (!name) name = $(el).text().trim() || `Steam App ${steamAppId}`

        if (!games.some((g) => g.steamAppId === steamAppId)) {
          games.push({ name: name.slice(0, 50), steamAppId })
        }
      }
    })

    console.log(`Found ${games.length} games with Steam links:`)
    games.slice(0, 5).forEach((g) => console.log(`  - [${g.steamAppId}] ${g.name}`))
    if (games.length > 5) console.log(`  ... and ${games.length - 5} more`)
  } catch (error: any) {
    console.log(`❌ Error: ${error.response?.status || error.message}`)
  }
}

testTurnBasedLovers()
