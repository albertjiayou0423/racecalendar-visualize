import { NextResponse } from "next/server"
import { getSqlOrFail, initDb, isDbAvailable, checkAiQuota, incrementAiUsage } from "@/lib/db"

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "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"
const AI_DAILY_LIMIT = 50

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
      return NextResponse.json({
        eventId,
        results: [],
        total: 0,
        myVote: null,
      })
    }

    await initDb()
    const sql = await getSqlOrFail()

    const results = await sql`
      SELECT driver_code, COUNT(*) as count
      FROM predictions
      WHERE event_id = ${eventId}
      GROUP BY driver_code
      ORDER BY count DESC
    `

    const total = results.reduce((sum: number, r: any) => sum + Number(r.count), 0)

    return NextResponse.json({
      eventId,
      results: results.map((r: any) => ({
        driverCode: r.driver_code,
        count: Number(r.count),
      })),
      total,
      myVote: null,
    })
  } catch (error) {
    console.error("GET predictions error:", error)
    return NextResponse.json(
      { error: "Failed to fetch predictions" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body: PredictionRequest = await request.json()
    const { eventId, series, eventName, circuit, driverCode } = body

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing required field: eventId" },
        { status: 400 }
      )
    }

    // 投票不消耗 AI 配额，也不需要 series
    if (driverCode) {
      return handleVote(eventId, driverCode)
    }

    // AI 预测需要 series
    if (!series) {
      return NextResponse.json(
        { error: "Missing required field: series" },
        { status: 400 }
      )
    }

    // 检查 AI 配额
    await initDb()
    const quota = await checkAiQuota()
    if (!quota.allowed) {
      return NextResponse.json({
        eventId,
        predictions: generateDefaultPredictions(series),
        generatedAt: new Date().toISOString(),
        modelUsed: "fallback",
        quotaExceeded: true,
        quotaRemaining: 0,
        error: `今日 AI 预测次数已用完（${AI_DAILY_LIMIT}次/天），使用默认预测`
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

    // AI 调用成功，增加使用计数
    await incrementAiUsage()
    const newQuota = await checkAiQuota()

    return NextResponse.json({
      eventId,
      predictions,
      generatedAt: new Date().toISOString(),
      modelUsed: "nvidia-nim/llama-3.1-8b-instruct",
      rawAnalysis: content,
      quotaRemaining: newQuota.remaining,
    })
  } catch (error) {
    console.error("Prediction API error:", error)
    return NextResponse.json(
      { error: "Failed to generate predictions" },
      { status: 500 }
    )
  }
}

async function handleVote(eventId: string, driverCode: string) {
  try {
    if (!isDbAvailable()) {
      return NextResponse.json({
        success: true,
        message: "预测已保存（演示模式）",
      })
    }

    await initDb()
    const sql = await getSqlOrFail()

    const voterId = "anonymous-" + Math.random().toString(36).slice(2)

    await sql`
      INSERT INTO predictions (event_id, driver_code, voter_id)
      VALUES (${eventId}, ${driverCode}, ${voterId})
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

    return NextResponse.json({
      success: true,
      results: results.map((r: any) => ({
        driverCode: r.driver_code,
        count: Number(r.count),
      })),
      total,
      myVote: driverCode,
    })
  } catch (error) {
    console.error("Vote error:", error)
    return NextResponse.json(
      { error: "Failed to vote" },
      { status: 500 }
    )
  }
}

function parsePredictions(content: string, series: string) {
  const predictions = []
  const lines = content.split("\n").filter((l: string) => l.trim())

  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i]

    const posMatch = line.match(/^(\d+)\./)
    const position = posMatch ? parseInt(posMatch[1]) : i + 1

    const dashParts = line.split(/[-–—]/).map((p) => p.trim())
    let driver = ""
    let team = ""
    let reason = ""

    if (dashParts.length >= 3) {
      driver = dashParts[0].replace(/^\d+\.\s*/, "").replace(/^(冠军|亚军|季军|第[一二三]名)\s*[：:]\s*/, "")
      team = dashParts[1]
      reason = dashParts.slice(2).join(" - ")
    } else if (dashParts.length === 2) {
      driver = dashParts[0].replace(/^\d+\.\s*/, "").replace(/^(冠军|亚军|季军|第[一二三]名)\s*[：:]\s*/, "")
      team = series
      reason = dashParts[1]
    } else {
      driver = line.replace(/^\d+\.\s*/, "").replace(/^(冠军|亚军|季军|第[一二三]名)\s*[：:]\s*/, "").slice(0, 30)
      team = series
      reason = line.slice(0, 100)
    }

    driver = driver.trim()
    team = team.trim()
    reason = reason.trim()

    if (!driver || driver.length < 2) {
      driver = `预测${position}`
    }

    predictions.push({
      position,
      driver,
      team,
      confidence: Math.max(50, 85 - position * 10),
      reason: reason || "基于历史数据分析",
    })
  }

  const sorted = [...predictions].sort((a, b) => a.position - b.position)

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
