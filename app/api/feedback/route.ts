import { NextRequest, NextResponse } from "next/server"
import { initFeedbackTable, saveFeedback, getFeedbacks, deleteFeedback } from "@/lib/crawl-store"

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
    await initFeedbackTable()

    const body: FeedbackRequest = await request.json()

    if (!body.type || !body.title || !body.description) {
      return NextResponse.json(
        { error: "缺少必要字段" },
        { status: 400 }
      )
    }

    await saveFeedback({
      type: body.type,
      title: body.title,
      description: body.description,
      email: body.email,
      browser: body.browser,
      system: body.system,
      ip: request.ip || request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || undefined,
    })

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

export async function GET(request: NextRequest) {
  try {
    const auth = request.cookies.get("admin_auth")
    if (!auth || auth.value !== "authenticated") {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    await initFeedbackTable()
    const feedbacks = await getFeedbacks(100)
    return NextResponse.json({ feedbacks })
  } catch (error) {
    console.error("获取反馈失败:", error)
    return NextResponse.json({ error: "获取失败" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = request.cookies.get("admin_auth")
    if (!auth || auth.value !== "authenticated") {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 })
    }

    await deleteFeedback(Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除反馈失败:", error)
    return NextResponse.json({ error: "删除失败" }, { status: 500 })
  }
}