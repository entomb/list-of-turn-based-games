// Test script for Steam App Details API
// Run: npx tsx src/test-steam-api.ts [appid]

import axios from "axios"

const TEST_APP_ID = parseInt(process.argv[2]) || 1086940 // Baldur's Gate 3

async function testSteamAppDetails(appId: number) {
  console.log(`🧪 Testing Steam App Details API for appId: ${appId}\n`)

  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`
  console.log(`URL: ${url}\n`)

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
    })

    console.log(`✅ Status: ${response.status}`)
    const data = response.data[appId.toString()]

    if (data.success) {
      const d = data.data
      console.log(`\nGame: ${d.name}`)
      console.log(`Developer: ${d.developers?.join(", ") || "N/A"}`)
      console.log(`Publisher: ${d.publishers?.join(", ") || "N/A"}`)
      console.log(`Release: ${d.release_date?.date || "N/A"}`)
      console.log(`Genres: ${d.genres?.map((g: any) => g.description).join(", ") || "N/A"}`)
      console.log(`Short desc: ${d.short_description?.slice(0, 100)}...`)
      console.log(`Header image: ${d.header_image || "N/A"}`)
      if (d.metacritic) {
        console.log(`Metacritic: ${d.metacritic.score} (${d.metacritic.url})`)
      }
    } else {
      console.log(`❌ App not found or unavailable`)
    }

    return true
  } catch (error: any) {
    console.log(`❌ Error: ${error.response?.status || error.message}`)
    return false
  }
}

async function testSteamReviews(appId: number) {
  console.log(`\n🧪 Testing Steam Reviews API for appId: ${appId}\n`)

  const url = `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all`
  console.log(`URL: ${url}\n`)

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 15000,
    })

    console.log(`✅ Status: ${response.status}`)

    if (response.data.success) {
      const qs = response.data.query_summary
      console.log(`Review score: ${qs.review_score} (${qs.review_score_desc})`)
      console.log(`Total reviews: ${qs.total_reviews}`)
      console.log(`Positive: ${qs.total_positive}`)
      console.log(`Negative: ${qs.total_negative}`)
    } else {
      console.log(`❌ Reviews not available`)
    }

    return true
  } catch (error: any) {
    console.log(`❌ Error: ${error.response?.status || error.message}`)
    return false
  }
}

async function testSteamStorePage(appId: number) {
  console.log(`\n🧪 Testing Steam Store Page (for tags) appId: ${appId}\n`)

  const url = `https://store.steampowered.com/app/${appId}`
  console.log(`URL: ${url}\n`)

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: "birthtime=0; mature_content=1; wants_mature_content=1",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
      maxRedirects: 5,
    })

    console.log(`✅ Status: ${response.status}`)
    console.log(`Content length: ${response.data.length} bytes`)

    // Try to extract tags
    const tagMatch = response.data.match(/InitAppTagModal\([^,]+,\s*(\[[^\]]+\])/s)
    if (tagMatch) {
      try {
        const tags = JSON.parse(tagMatch[1])
        console.log(`\nTags found: ${tags.length}`)
        tags.slice(0, 10).forEach((t: any) => console.log(`  - ${t.name}`))
      } catch {
        console.log(`Could not parse tags`)
      }
    } else {
      console.log(`No tags found in page`)
    }

    return true
  } catch (error: any) {
    console.log(`❌ Error: ${error.response?.status || error.message}`)
    if (error.response?.status === 403) {
      console.log(`\n⚠️  403 Forbidden - Steam may be rate limiting or blocking`)
      console.log(`Try adding a delay between requests or using different headers`)
    }
    return false
  }
}

async function runAllTests() {
  console.log("=" .repeat(60))
  console.log("  Steam API Test Suite")
  console.log("=".repeat(60))

  await testSteamAppDetails(TEST_APP_ID)
  await new Promise((r) => setTimeout(r, 1000))

  await testSteamReviews(TEST_APP_ID)
  await new Promise((r) => setTimeout(r, 1000))

  await testSteamStorePage(TEST_APP_ID)

  console.log("\n" + "=".repeat(60))
  console.log("  Tests complete")
  console.log("=".repeat(60))
}

runAllTests()
