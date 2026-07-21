import { NextRequest, NextResponse } from "next/server"

interface FeedbackRequest {
  type: "bug" | "feature" | "suggestion" | "other"
  title: string
  description: string
  email?: string
  browser?: string
  system?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json()

    if (!body.type || !body.title || !body.description) {
      return NextResponse.json(
        { error: "缺少必要字段" },
        { status: 400 }
      )
    }

    const feedback = {
      ...body,
      createdAt: new Date().toISOString(),
      ip: request.ip || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    }

    console.log("收到反馈:", feedback)

    return NextResponse.json({
      success: true,
      message: "感谢你的反馈！我们会尽快处理。",
    })
  } catch (error) {
    console.error("反馈提交失败:", error)
    return NextResponse.json(
      { error: "提交失败，请稍后重试" },
      { status: 500 }
    )
  }
}