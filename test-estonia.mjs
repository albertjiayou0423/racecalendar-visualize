const feedUrl = "https://www.wrc.com/v3/api/graphql/v1/v3/feed/en-INT?disableUsageRestrictions=true&filter[type]=event-details&filter[uriSlug]=itinerary-wrc-rally-estonia-2026&page[limit]=1&rb3Locale=en&rb3Schema=v1:inlineContent"
const startDate = "2026-07-17"

const MONTH_MAP = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
}

function parseDateText(dateText, fallbackDate) {
  const match = dateText.match(/(\w+),\s*(\d{1,2})\s+(\w+)/)
  if (match) {
    const day = parseInt(match[2], 10)
    const month = MONTH_MAP[match[3]]
    const [startY] = fallbackDate.split("-").map(Number)
    if (month) return [startY, month, day]
  }
  const [y, m, d] = fallbackDate.split("-").map(Number)
  return [y, m, d]
}

const res = await fetch(feedUrl, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
  },
  signal: AbortSignal.timeout(15000),
})
const json = await res.json()
const items = json?.data?.items || []

console.log(`Items: ${items.length}`)

for (const item of items) {
  if (item.type !== "faq") continue
  const title = item.title || ""
  console.log(`\nFAQ title: "${title}"`)
  console.log(`  has itinerary (lower): ${title.toLowerCase().includes("itinerary")}`)
  console.log(`  has UTC: ${title.includes("UTC")}`)
  console.log(`  has Version: ${title.includes("Version")}`)
  
  // Check filter condition
  const pass = title.toLowerCase().includes("itinerary") || title.includes("UTC") || title.includes("Version")
  console.log(`  Passes filter: ${pass}`)
  
  if (!item.elements) continue
  
  console.log(`  elements: ${item.elements.length}`)
  
  for (const element of item.elements) {
    const question = element.question
    const answer = element.answer
    
    if (!Array.isArray(question) || !Array.isArray(answer)) {
      console.log(`  Skipping: question or answer not array`)
      continue
    }
    
    const dateText = question.find(q => q.variant === "text")?.text || ""
    console.log(`  Q: "${dateText}"`)
    const date = parseDateText(dateText, startDate)
    console.log(`  Date: ${date}`)
    
    const stages = []
    
    for (const ans of answer) {
      if (ans.type !== "list" || !Array.isArray(ans.items)) continue
      
      console.log(`  Answer list items: ${ans.items.length}`)
      
      for (const listItem of ans.items) {
        if (!listItem.elements) continue
        for (const el of listItem.elements) {
          if (el.variant !== "text") continue
          const text = el.text || ""
          console.log(`    Text: "${text}"`)
          
          const stageMatch = text.match(/^(\d{1,2}:\d{2}):\s*(.+)$/)
          console.log(`    Match: ${stageMatch ? 'YES' : 'NO'}`)
          
          if (stageMatch) {
            const time = stageMatch[1].padStart(5, "0")
            const name = stageMatch[2].trim()
            const isPowerStage = name.toLowerCase().includes("power stage") || name.toLowerCase().includes("wolf power")
            stages.push({ time, name, isPowerStage })
          }
        }
      }
    }
    
    if (stages.length > 0) {
      console.log(`  Stages: ${stages.length}`)
    }
  }
}

