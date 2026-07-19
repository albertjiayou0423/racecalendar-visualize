import {
  extractPrerenderCache,
  extractItineraryUrlFromCache,
  parseDateText,
  extractTagBlocks,
  parseItineraryFromHtml,
  findFaqItems,
  parseItems,
  parseItineraryFromCache,
  MONTH_MAP
} from "./wrc-puppeteer"

// 简易测试套件实现以在 sandbox 环境中直接运行测试
function describe(name: string, fn: () => void) {
  console.log(`\n=== Suite: ${name} ===`)
  fn()
}

function it(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ Pass: ${name}`)
  } catch (error) {
    console.error(`  ✗ Fail: ${name}`)
    console.error(error)
    process.exit(1)
  }
}

function assert(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || "Assertion failed")
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message || "Assertion failed"}: Expected ${JSON.stringify(
        expected
      )}, but got ${JSON.stringify(actual)}`
    )
  }
}

// 运行测试用例
describe("WRC Crawler Robustness Tests", () => {
  it("extractPrerenderCache handles varied attribute casing and quotes", () => {
    const html1 = `<script type="application/json" id="rb3-prerender-data-cache">{"key": "val"}</script>`
    const html2 = `<script ID='rb3-prerender-data-cache' type="application/json">{"key": "val2"}</script>`
    const html3 = `<script id="rb3-prerender-data-cache">{"key": "val3"}</script>`

    assertEquals(extractPrerenderCache(html1), { key: "val" })
    assertEquals(extractPrerenderCache(html2), { key: "val2" })
    assertEquals(extractPrerenderCache(html3), { key: "val3" })
  })

  it("extractItineraryUrlFromCache falls back dynamically via deep matching", () => {
    const cacheNormal = {
      "someKey-pageTabs": {
        data: {
          data: {
            tabs: [{ label: "Itinerary", url: "/some-url" }]
          }
        }
      }
    }
    const cacheDeep = {
      nested: {
        deeply: {
          array: [
            { label: "Itinerary Details", url: "/deep-url" }
          ]
        }
      }
    }

    assertEquals(extractItineraryUrlFromCache(cacheNormal), "https://www.wrc.com/some-url")
    assertEquals(extractItineraryUrlFromCache(cacheDeep), "https://www.wrc.com/deep-url")
  })

  it("parseDateText parses various English formats safely", () => {
    // 基础英文月份拼写
    assertEquals(parseDateText("Thursday, 22 January 2026", "2026-01-01"), [2026, 1, 22])
    // 缩写 + 大小写不敏感
    assertEquals(parseDateText("Thursday, Jan 25, 2026", "2026-01-01"), [2026, 1, 25])
    // 缺省年份以 fallbackDate 为基准
    assertEquals(parseDateText("Friday, 13 February", "2026-02-01"), [2026, 2, 13])
    // 完全错误的格式以 fallbackDate 兜底
    assertEquals(parseDateText("invalid random text", "2026-03-12"), [2026, 3, 12])
  })

  it("extractTagBlocks parses HTML tag boundaries considering nesting depth", () => {
    const html = `
      <div class="day-section">
        <div>nested inside</div>
        <div class="day-inner">nested class</div>
      </div>
      <div class="other-section">should not match</div>
    `
    const blocks = extractTagBlocks(html, /day-section/i, "div")
    assert(blocks.length === 1)
    assert(blocks[0].includes("nested inside"))
    assert(blocks[0].includes("nested class"))
    assert(!blocks[0].includes("should not match"))
  })

  it("parseItineraryFromHtml extracts stages and handles nested markup safely", () => {
    const html = `
      <div class="day-section">
        <h3>Thursday, 22 January</h3>
        <cosmos-text class="css-123">08:00: <strong>Shakedown</strong></cosmos-text>
        <cosmos-text class="css-456">12:30: Wolf Power Stage</cosmos-text>
      </div>
    `
    const days = parseItineraryFromHtml(html, "2026-01-22")
    assert(days !== null)
    assertEquals(days!.length, 1)
    assertEquals(days![0].date, [2026, 1, 22])
    assertEquals(days![0].stages.length, 2)
    assertEquals(days![0].stages[0], { time: "08:00", name: "Shakedown", isPowerStage: false })
    assertEquals(days![0].stages[1], { time: "12:30", name: "Wolf Power Stage", isPowerStage: true })
  })

  it("parseItineraryFromCache correctly parses nested structures & uses fallback deep matching", () => {
    const cacheNormal = {
      "key": {
        data: {
          data: {
            items: [
              {
                type: "faq",
                title: "Itinerary Info",
                elements: [
                  {
                    question: [{ variant: "text", text: "Thursday, 22 January" }],
                    answer: [
                      {
                        type: "list",
                        items: [
                          {
                            elements: [
                              { variant: "text", text: "08:00: Shakedown" }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    }

    const days = parseItineraryFromCache(cacheNormal, "2026-01-22")
    assert(days !== null)
    assertEquals(days!.length, 1)
    assertEquals(days![0].date, [2026, 1, 22])
    assertEquals(days![0].stages[0], { time: "08:00", name: "Shakedown", isPowerStage: false })
  })
})

console.log("\nAll crawler robustness tests executed and PASSED successfully!\n")
