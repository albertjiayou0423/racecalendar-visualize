import { fetchWrc } from "./wrc-puppeteer"
import * as fs from "fs"
import * as path from "path"

async function run() {
  console.log("Starting full-calendar WRC scraper...")
  const result = await fetchWrc()

  const officialData: Record<number, any[]> = {}
  result.events.forEach(event => {
    // 只有非 ocblacktop / 或者是有效的 official 赛程才存入
    officialData[event.round] = event.sessions
  })

  const filepath = path.join(process.cwd(), "lib", "wrc-official-itineraries.json")
  fs.writeFileSync(filepath, JSON.stringify(officialData, null, 2), "utf8")
  console.log(`Successfully scraped and wrote WRC itineraries to ${filepath}!`)
  process.exit(0)
}

run().catch(err => {
  console.error("Full scraper failed:", err)
  process.exit(1)
})
