// Check Vercel deployment
const urls = [
  "https://racecalendar-visualize-kyjrwi2d8-tangjiayou23-7566s-projects.vercel.app/",
  "https://racecalendar-visualize-kyjrwi2d8-tangjiayou23-7566s-projects.vercel.app/api/schedule",
  "https://racecalendar-visualize-git-t-1787c8-tangjiayou23-7566s-projects.vercel.app/",
  "https://racecalendar-visualize-git-t-1787c8-tangjiayou23-7566s-projects.vercel.app/api/schedule",
]

for (const url of urls) {
  try {
    console.log(`\nFetching: ${url}`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    console.log(`  Status: ${res.status}`)
    const text = await res.text()
    console.log(`  Length: ${text.length}`)
    if (url.includes("/api/schedule")) {
      // Try to parse JSON and check WRC data
      try {
        const data = JSON.parse(text)
        const wrcSource = data.sources?.find(s => s.series === "WRC")
        console.log(`  WRC source: ${JSON.stringify(wrcSource)}`)
        // Find WRC events with sessions
        const wrcEvents = data.events?.filter(e => e.series === "WRC" || e.round)
        if (wrcEvents) {
          for (const ev of wrcEvents.slice(0, 3)) {
            console.log(`  Event: ${ev.name} - sessions: ${ev.sessions?.length || 0}`)
            if (ev.sessions?.length > 0) {
              console.log(`    First session: ${JSON.stringify(ev.sessions[0])}`)
              console.log(`    Last session: ${JSON.stringify(ev.sessions[ev.sessions.length - 1])}`)
            }
          }
        }
      } catch (e) {
        console.log(`  JSON parse error: ${e.message}`)
        console.log(`  First 500 chars: ${text.substring(0, 500)}`)
      }
    } else {
      console.log(`  First 300 chars: ${text.substring(0, 300)}`)
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`)
  }
}
