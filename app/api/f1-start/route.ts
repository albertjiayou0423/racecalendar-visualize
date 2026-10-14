import { NextRequest, NextResponse } from 'next/server'
import { readF1StartFeed } from '@/lib/f1-start-feed'
export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  const target = Date.parse(request.nextUrl.searchParams.get('target') ?? '')
  const delta = target - Date.now()
  if (!Number.isFinite(target)) return NextResponse.json({ error: 'invalid-target' }, { status: 400 })
  if (delta > 30 * 60000 || delta < -10 * 60000) return NextResponse.json({ phase: 'unknown', reason: 'outside-start-window', observedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  // Do not enter the browser/Service Worker offline cache: replayed states are unsafe here.
  return NextResponse.json(await readF1StartFeed(target), { headers: { 'Cache-Control': 'no-store' } })
}
