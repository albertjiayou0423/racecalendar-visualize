// Use PhantomJsCloud to fetch the Vercel deployment (since sandbox can't reach *.vercel.app directly)
const PHANTOMJS_API_KEY = "a-demo-key-with-low-quota-per-ip-address"

async function fetchViaPhantomJsCloud(url) {
  const requestPayload = {
    url,
    renderType: "plainText",
    requestSettings: {
      doneWhen: [
        { event: "domReady" },
        { event: "timeout", ms: 60000 },
      ],
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  }

  const apiUrl = `https://phantomjscloud.com/api/browser/v2/${PHANTOMJS_API_KEY}/?request=${encodeURIComponent(JSON.stringify(requestPayload))}`
  const res = await fetch(apiUrl)
  if (!res.ok) {
    console.error(`PhantomJsCloud failed: ${res.status}`)
    return null
  }
  return res.text()
}

// The Vercel deployment URLs to check
const urls = [
  "https://racecalendar-visualize-oawy6mfqt-tangjiayou23-7566s-projects.vercel.app/api/schedule",
  "https://racecalendar-visualize-kyjrwi2d8-tangjiayou23-7566s-projects.vercel.app/api/schedule",
]

for (const url of urls) {
  console.log(`\nFetching via PhantomJsCloud: ${url}`)
  const text = await fetchViaPhantomJsCloud(url)
  if (!text) {
    console.log("  Failed to fetch")
    continue
  }
  console.log(`  Response length: ${text.length}`)
  console.log(`  First 500 chars: ${text.substring(0, 500)}`)

  // Try to parse as JSON
  try {
    // The response might be wrapped in HTML, so try to extract JSON
    const jsonStart = text.indexOf("{")
    const jsonEnd = text.lastIndexOf("}")
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = text.substring(jsonStart, jsonEnd + 1)
      const data = JSON.parse(jsonStr)

      const wrcSource = data.sources?.find(s => s.series === "WRC")
      console.log(`  WRC source: ${JSON.stringify(wrcSource)}`)

      const wrcEvents = data.events?.filter(e => e.series === "WRC")
      if (wrcEvents) {
        for (const ev of wrcEvents.slice(0, 5)) {
          console.log(`  Event: ${ev.name} - sessions: ${ev.sessions?.length || 0}`)
          if (ev.sessions?.length > 0) {
            console.log(`    First: ${ev.sessions[0].name} @ ${ev.sessions[0].utc}`)
            console.log(`    Last: ${ev.sessions[ev.sessions.length-1].name} @ ${ev.sessions[ev.sessions.length-1].utc}`)
          }
        }
      }
    }
  } catch (e) {
    console.log(`  JSON parse error: ${e.message}`)
  }
}
