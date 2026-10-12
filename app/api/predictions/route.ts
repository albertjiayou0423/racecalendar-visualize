import { NextResponse } from "next/server"
import { getSqlOrFail, initDb, isDbAvailable, consumeAiQuotaSlot, AI_DAILY_LIMIT } from "@/lib/db"
import { anonymousVoterCookie, resolveAnonymousVoterId } from "@/lib/anonymous-voter"

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY

interface PredictionRequest {
  eventId: string
  series: string
  eventName?: string
  circuit?: string
  driverCode?: string
}

interface PredictionResponse {
  eventId: string
  predictions: {
    position: number
    driver: string
    team: string
    confidence: number
    reason: string
  }[]
  generatedAt: string
  modelUsed: string
}

export async function GET(request: Request) {
  const voter = resolveAnonymousVoterId(request.headers.get("cookie"))
  try {
    const url = new URL(request.url)
    const eventId = url.searchParams.get("eventId")

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing eventId" },
        { status: 400 }
      )
    }

    if (!isDbAvailable()) {
      return voterResponse({
        eventId,
        results: [],
        total: 0,
        myVote: null,
      }, voter)
    }

    await initDb()
    const sql = await getSqlOrFail()

    const results = await sql`
      SELECT driver_code, COUNT(*) as count, BOOL_OR(voter_id = ${voter.id}) as is_mine
      FROM predictions
      WHERE event_id = ${eventId}
      GROUP BY driver_code
      ORDER BY count DESC
    `

    const total = results.reduce((sum: number, r: any) => sum + Number(r.count), 0)

    return voterResponse({
      eventId,
      results: results.map((r: any) => ({
        driverCode: r.driver_code,
        count: Number(r.count),
      })),
      total,
      myVote: results.find((result: any) => result.is_mine)?.driver_code ?? null,
    }, voter)
  } catch (error) {
    console.error("GET predictions error:", error)
    return voterResponse(
      { error: "Failed to fetch predictions" },
      voter,
      500,
    )
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 })
  }

  const { eventId, series, eventName, circuit, driverCode } = body as Partial<PredictionRequest>
  if (typeof eventId !== "string" || !eventId.trim() || eventId.length > 160) {
    return NextResponse.json({ error: "eventId must be a non-empty string of at most 160 characters" }, { status: 400 })
  }

  if (driverCode !== undefined && (typeof driverCode !== "string" || !driverCode.trim() || driverCode.length > 100)) {
    return NextResponse.json({ error: "driverCode must be a non-empty string of at most 100 characters" }, { status: 400 })
  }

  if (eventName !== undefined && (typeof eventName !== "string" || eventName.length > 200)) {
    return NextResponse.json({ error: "eventName must be at most 200 characters" }, { status: 400 })
  }

  if (circuit !== undefined && (typeof circuit !== "string" || circuit.length > 200)) {
    return NextResponse.json({ error: "circuit must be at most 200 characters" }, { status: 400 })
  }

  // 投票不消耗 AI 配额，也不需要 series
  if (driverCode !== undefined) {
    return handleVote(eventId.trim(), driverCode.trim(), request.headers.get("cookie"))
  }

  // AI 预测需要 series
  if (series !== "F1" && series !== "WRC" && series !== "FE") {
    return NextResponse.json(
      { error: "series must be F1, WRC or FE" },
      { status: 400 }
    )
  }

  try {

    if (!NVIDIA_NIM_API_KEY) {
      return NextResponse.json({ eventId, predictions: generateDefaultPredictions(series), modelUsed: "fallback", generatedAt: new Date().toISOString(), error: "AI 服务未配置，使用默认预测" })
    }

    // 原子占用额度后再请求上游，避免并发请求同时通过额度检查。
    await initDb()
    const quota = await consumeAiQuotaSlot()
    if (!quota.allowed) {
      return NextResponse.json({
        eventId,
        predictions: generateDefaultPredictions(series),
        generatedAt: new Date().toISOString(),
        modelUsed: "fallback",
        quotaExceeded: quota.reason === "limit",
        quotaRemaining: 0,
        error: quota.reason === "limit"
          ? `今日 AI 预测次数已用完（${AI_DAILY_LIMIT}次/天），使用默认预测`
          : "AI 额度暂时无法核验，使用默认预测",
      })
    }

    const prompt = `你是赛车运动分析师。请根据历史数据、车手表现、赛道特性预测 ${series} ${eventName} 的比赛结果。

赛事信息：
- 系列：${series}
- 赛事名称：${eventName}
- 赛道：${circuit}

请预测前3名完赛者，并给出简要分析。格式要求：
1. 冠军：[车手名] - [车队] - 获胜理由（1-2句话）
2. 亚军：[车手名] - [车队] - 理由
3. 季军：[车手名] - [车队] - 理由

注意：这是基于历史数据和赛道特性的分析预测，仅供参考。`

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NVIDIA_NIM_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-8b-instruct",
        messages: [
          {
            role: "system",
            content: "你是专业的赛车运动分析师，熟悉F1、WRC、Formula E等赛事。你的分析基于车手历史表现、车队实力、赛道特性和天气条件等因素。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 512,
        temperature: 0.7,
        top_p: 0.9,
      }),
    })

    if (!response.ok) {
      console.error("NVIDIA NIM API error:", response.status, await response.text())
      return NextResponse.json({
        eventId,
        predictions: generateDefaultPredictions(series),
        generatedAt: new Date().toISOString(),
        modelUsed: "fallback",
        error: "AI service unavailable, using fallback predictions"
      })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""

    const predictions = parsePredictions(content, series)

    return NextResponse.json({
      eventId,
      predictions,
      generatedAt: new Date().toISOString(),
      modelUsed: "nvidia-nim/llama-3.1-8b-instruct",
      rawAnalysis: content,
      quotaRemaining: quota.remaining,
    })
  } catch (error) {
    console.error("Prediction API error:", error)
    return NextResponse.json(
      { error: "Failed to generate predictions" },
      { status: 500 }
    )
  }
}

async function handleVote(eventId: string, driverCode: string, cookieHeader: string | null) {
  try {
    if (!isDbAvailable()) {
      return NextResponse.json({
        success: true,
        message: "预测已保存（演示模式）",
      })
    }

    await initDb()
    const sql = await getSqlOrFail()
    const voter = resolveAnonymousVoterId(cookieHeader)

    await sql`
      INSERT INTO predictions (event_id, driver_code, voter_id)
      VALUES (${eventId}, ${driverCode}, ${voter.id})
      ON CONFLICT (event_id, voter_id) DO UPDATE SET driver_code = ${driverCode}
    `

    const results = await sql`
      SELECT driver_code, COUNT(*) as count
      FROM predictions
      WHERE event_id = ${eventId}
      GROUP BY driver_code
      ORDER BY count DESC
    `

    const total = results.reduce((sum: number, r: any) => sum + Number(r.count), 0)

    return voterResponse({
      success: true,
      results: results.map((r: any) => ({
        driverCode: r.driver_code,
        count: Number(r.count),
      })),
      total,
      myVote: driverCode,
    }, voter)
  } catch (error) {
    console.error("Vote error:", error)
    return NextResponse.json(
      { error: "Failed to vote" },
      { status: 500 }
    )
  }
}

function voterResponse(body: Record<string, unknown>, voter: ReturnType<typeof resolveAnonymousVoterId>, status = 200) {
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
  if (voter.isNew) response.headers.append("Set-Cookie", anonymousVoterCookie(voter.id))
  return response
}

function parsePredictions(content: string, series: string) {
  const predictions = []

  const lines = content.split("\n").filter((l: string) => l.trim())

  for (const line of lines) {
    const trimmed = line.trim()

    const posMatch = trimmed.match(/^(?:(\d+)\.|第([一二三])名|(?:冠军|亚军|季军))\s*/)
    if (!posMatch) continue

    let position = 0
    if (posMatch[1]) position = parseInt(posMatch[1])
    else if (posMatch[2]) position = ["一", "二", "三"].indexOf(posMatch[2]) + 1
    else if (trimmed.includes("冠军")) position = 1
    else if (trimmed.includes("亚军")) position = 2
    else if (trimmed.includes("季军")) position = 3

    if (position < 1 || position > 3) continue

    const remaining = trimmed.replace(/^(?:\d+\.|第[一二三]名|冠军|亚军|季军)\s*/, "")

    const dashParts = remaining.split(/[-–—]/).map((p) => p.trim()).filter(Boolean)

    let driver = ""
    let team = ""
    let reason = ""

    if (dashParts.length >= 3) {
      driver = dashParts[0]
      team = dashParts[1]
      reason = dashParts.slice(2).join(" - ")
    } else if (dashParts.length === 2) {
      driver = dashParts[0]
      team = dashParts[1]
    } else {
      driver = remaining.slice(0, 40).trim()
      team = series
    }

    driver = driver.replace(/^[：:]\s*/, "").trim()
    team = team.replace(/^[：:]\s*/, "").trim()

    if (!driver || driver.length < 2 || driver.length > 50) continue

    predictions.push({
      position,
      driver,
      team: team || series,
      confidence: Math.max(50, 85 - position * 10),
      reason: reason || "基于历史数据分析",
    })
  }

  const uniquePredictions = predictions.filter(
    (p, i, arr) => arr.findIndex((x) => x.position === p.position) === i
  )

  const sorted = [...uniquePredictions].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sorted.length; i++) {
    sorted[i].position = i + 1
  }

  return sorted.length > 0 ? sorted : generateDefaultPredictions(series)
}

function generateDefaultPredictions(series: string) {
  const defaults: Record<string, { driver: string; team: string }[]> = {
    F1: [
      { driver: "Max Verstappen", team: "Red Bull Racing" },
      { driver: "Lando Norris", team: "McLaren" },
      { driver: "Charles Leclerc", team: "Ferrari" },
    ],
    WRC: [
      { driver: "Kalle Rovanperä", team: "Toyota Gazoo Racing" },
      { driver: "Sébastien Ogier", team: "Toyota Gazoo Racing" },
      { driver: "Thierry Neuville", team: "Hyundai Shell Mobis" },
    ],
    FE: [
      { driver: "Mitch Evans", team: "Jaguar TCS Racing" },
      { driver: "Nick Cassidy", team: "Jaguar TCS Racing" },
      { driver: "Pascal Wehrlein", team: "TAG Heuer Porsche" },
    ],
  }

  const drivers = defaults[series] || defaults.F1
  return drivers.map((d, i) => ({
    position: i + 1,
    driver: d.driver,
    team: d.team,
    confidence: 75 - i * 10,
    reason: "基于赛季表现和历史数据分析",
  }))
}
