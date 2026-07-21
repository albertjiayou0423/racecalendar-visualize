import { NextResponse } from "next/server"

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "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"

interface PredictionRequest {
  eventId: string
  series: string
  eventName: string
  circuit: string
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

export async function POST(request: Request) {
  try {
    const body: PredictionRequest = await request.json()
    const { eventId, series, eventName, circuit } = body

    if (!eventId || !series) {
      return NextResponse.json(
        { error: "Missing required fields: eventId, series" },
        { status: 400 }
      )
    }

    // 构建提示词
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

    // 调用 Nvidia NIM API（使用 Llama 模型）
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
      // 返回默认预测结果
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

    // 解析AI返回的预测结果
    const predictions = parsePredictions(content, series)

    return NextResponse.json({
      eventId,
      predictions,
      generatedAt: new Date().toISOString(),
      modelUsed: "nvidia-nim/llama-3.1-8b-instruct",
      rawAnalysis: content,
    })
  } catch (error) {
    console.error("Prediction API error:", error)
    return NextResponse.json(
      { error: "Failed to generate predictions" },
      { status: 500 }
    )
  }
}

function parsePredictions(content: string, series: string) {
  const predictions = []
  const lines = content.split("\n").filter((l: string) => l.trim())

  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i]
    const match = line.match(/(\d+)\.\s*(.+?)\s*[-–]\s*(.+?)\s*[-–]\s*(.+)/i)
    if (match) {
      predictions.push({
        position: parseInt(match[1]) || i + 1,
        driver: match[2].trim(),
        team: match[3].trim(),
        confidence: 85 - i * 10,
        reason: match[4].trim(),
      })
    } else {
      // 简单解析
      predictions.push({
        position: i + 1,
        driver: `预测${i + 1}`,
        team: series,
        confidence: 80 - i * 15,
        reason: line.slice(0, 100),
      })
    }
  }

  return predictions.length > 0 ? predictions : generateDefaultPredictions(series)
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