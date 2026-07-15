import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql, initDb } from "@/lib/db"
import { randomUUID } from "crypto"

// 初始化数据库（在生产环境中应在部署时运行，这里简化处理）
let initialized = false
async function ensureDb() {
  if (!initialized) {
    await initDb()
    initialized = true
  }
}

function getVoterId(): string {
  const cookieStore = cookies()
  let voterId = cookieStore.get("voter_id")?.value
  if (!voterId) {
    voterId = randomUUID()
    cookieStore.set("voter_id", voterId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    })
  }
  return voterId
}

export async function GET(request: NextRequest) {
  await ensureDb()

  const searchParams = request.nextUrl.searchParams
  const eventId = searchParams.get("eventId")

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 })
  }

  try {
    const results = await sql`
      SELECT driver_code, COUNT(*) as count
      FROM predictions
      WHERE event_id = ${eventId}
      GROUP BY driver_code
      ORDER BY count DESC
    `

    // 获取当前用户的投票
    const voterId = getVoterId()
    const myVote = await sql`
      SELECT driver_code
      FROM predictions
      WHERE event_id = ${eventId} AND voter_id = ${voterId}
      LIMIT 1
    `

    return NextResponse.json({
      results: results.map((r) => ({
        driverCode: r.driver_code,
        count: Number(r.count),
      })),
      myVote: myVote[0]?.driver_code ?? null,
      total: results.reduce((sum, r) => sum + Number(r.count), 0),
    })
  } catch (err) {
    console.error("Failed to get predictions:", err)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  await ensureDb()

  try {
    const body = await request.json()
    const { eventId, driverCode } = body

    if (!eventId || !driverCode) {
      return NextResponse.json(
        { error: "eventId and driverCode are required" },
        { status: 400 }
      )
    }

    const voterId = getVoterId()

    // 使用 UPSERT：如果已投票则更新，否则插入
    await sql`
      INSERT INTO predictions (event_id, driver_code, voter_id)
      VALUES (${eventId}, ${driverCode}, ${voterId})
      ON CONFLICT (event_id, voter_id)
      DO UPDATE SET driver_code = ${driverCode}, created_at = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to save prediction:", err)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
}
