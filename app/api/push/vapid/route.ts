import { NextResponse } from "next/server"

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) {
    return NextResponse.json({ ok: false, message: "VAPID 公钥未配置" }, { status: 501 })
  }
  return NextResponse.json({ ok: true, publicKey })
}
