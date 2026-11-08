import { NextResponse } from "next/server"
import { logServerWarn } from "@/lib/server-log"

type MyMemoryResponse = {
  responseStatus?: number
  responseData?: { translatedText?: string }
}

const MAX_NAMES_PER_REQUEST = 25
const CACHE_SECONDS = 60 * 60 * 24 * 30

/** Translate display-only event titles; the canonical schedule data stays unchanged. */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求内容无效" }, { status: 400 })
  }

  const input = (body as { names?: unknown } | null)?.names
  if (!Array.isArray(input)) {
    return NextResponse.json({ error: "缺少赛事名称列表" }, { status: 400 })
  }

  const names = [...new Set(input
    .filter((name): name is string => typeof name === "string")
    .map(name => name.trim())
    .filter(name => name.length > 0 && name.length <= 100 && !/\p{Script=Han}/u.test(name)))
  ].slice(0, MAX_NAMES_PER_REQUEST)

  const translations: Record<string, string> = {}
  const results = await Promise.allSettled(names.map(async name => {
    const params = new URLSearchParams({ q: name, langpair: "en|zh-CN", mt: "1" })
    const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`)
    const result = await response.json() as MyMemoryResponse
    const translated = result.responseData?.translatedText?.trim()
    if (result.responseStatus !== 200 || !translated || !/\p{Script=Han}/u.test(translated)) return
    translations[name] = translated
  }))

  const failures = results.filter(result => result.status === "rejected").length
  if (failures) {
    logServerWarn("api.event_name_translation.partial_failure", {
      requested: names.length,
      translated: Object.keys(translations).length,
      failures,
    })
  }

  return NextResponse.json({ translations })
}
