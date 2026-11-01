"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Download, LoaderCircle, Share2, Video } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, formatDate, formatDateTime, mainSession } from "@/lib/format"
import { isTimeUnconfirmed } from "@/lib/session-time"
import { downloadFile } from "@/lib/download"
import { getTrackFlightRoute } from "@/lib/track-flight"

const WIDTH = 720
const HEIGHT = 1280
const DURATION_MS = 8500
const FPS = 30

const COLORS: Record<RaceEvent["series"], string> = {
  F1: "#ef4444",
  WRC: "#2f91ec",
  FE: "#22c55e",
}

type Point = { x: number; y: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function cubicOut(value: number) {
  return 1 - Math.pow(1 - clamp(value, 0, 1), 3)
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, color = "#f4f6f8", weight = 600) {
  let fitted = size
  ctx.font = `${weight} ${fitted}px Geist, "PingFang SC", "Microsoft YaHei", sans-serif`
  while (ctx.measureText(text).width > maxWidth && fitted > 18) {
    fitted -= 1
    ctx.font = `${weight} ${fitted}px Geist, "PingFang SC", "Microsoft YaHei", sans-serif`
  }
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

function mapRoute(points: [number, number][]): Point[] {
  const xs = points.map(point => point[0])
  const ys = points.map(point => point[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const routeWidth = Math.max(1, maxX - minX)
  const routeHeight = Math.max(1, maxY - minY)
  const scale = Math.min(405 / routeWidth, 445 / routeHeight)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  return points.map(([x, y]) => ({
    x: WIDTH / 2 + (x - centerX) * scale,
    y: 735 + (y - centerY) * scale,
  }))
}

function routeMetrics(points: Point[]) {
  const lengths = [0]
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y))
  }
  return { lengths, total: lengths.at(-1) || 1 }
}

function pointAt(points: Point[], progress: number, lengths: number[], total: number) {
  const distance = total * clamp(progress, 0, 1)
  let index = 1
  while (index < lengths.length - 1 && lengths[index] < distance) index++
  const before = points[index - 1]
  const after = points[index]
  const segment = Math.max(1, lengths[index] - lengths[index - 1])
  const blend = (distance - lengths[index - 1]) / segment
  return {
    x: before.x + (after.x - before.x) * blend,
    y: before.y + (after.y - before.y) * blend,
    angle: Math.atan2(after.y - before.y, after.x - before.x),
    lengths,
    total,
  }
}

function traceRoute(ctx: CanvasRenderingContext2D, points: Point[], endDistance: number, lengths: number[]) {
  if (!points.length) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index++) {
    if (lengths[index] <= endDistance) {
      ctx.lineTo(points[index].x, points[index].y)
      continue
    }
    const segmentLength = lengths[index] - lengths[index - 1]
    const t = segmentLength ? (endDistance - lengths[index - 1]) / segmentLength : 0
    ctx.lineTo(
      points[index - 1].x + (points[index].x - points[index - 1].x) * clamp(t, 0, 1),
      points[index - 1].y + (points[index].y - points[index - 1].y) * clamp(t, 0, 1),
    )
    break
  }
}

function drawDrone(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, accent: string, time: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(1 + Math.sin(time * 0.012) * 0.025, 1 + Math.sin(time * 0.012) * 0.025)

  ctx.shadowColor = `${accent}b0`
  ctx.shadowBlur = 26
  ctx.strokeStyle = "#d9e5ef"
  ctx.lineWidth = 8
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(-27, -22); ctx.lineTo(27, 22)
  ctx.moveTo(27, -22); ctx.lineTo(-27, 22)
  ctx.stroke()
  ctx.shadowBlur = 0

  for (const [rotorX, rotorY] of [[-30, -25], [30, -25], [-30, 25], [30, 25]]) {
    ctx.beginPath()
    ctx.fillStyle = "#111820"
    ctx.strokeStyle = `${accent}cc`
    ctx.lineWidth = 3
    ctx.ellipse(rotorX, rotorY, 15, 6, time * 0.018, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()
    ctx.beginPath()
    ctx.fillStyle = rotorX * rotorY < 0 ? accent : "#eef5fa"
    ctx.arc(rotorX, rotorY, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = "#dce6ed"
  ctx.beginPath()
  ctx.moveTo(0, -16); ctx.lineTo(12, -3); ctx.lineTo(10, 13); ctx.lineTo(0, 17); ctx.lineTo(-10, 13); ctx.lineTo(-12, -3)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = accent
  ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawFrame(canvas: HTMLCanvasElement, event: RaceEvent, route: ReturnType<typeof getTrackFlightRoute>, points: Point[], routeLengths: number[], routeLength: number, metadata: { year: string; date: string; beijingTime: string; uncertain: boolean }, elapsed: number) {
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) return
  const accent = COLORS[event.series]
  const progress = cubicOut(clamp((elapsed - 900) / (DURATION_MS - 2500), 0, 1))
  const reveal = cubicOut(elapsed / 1300)

  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  ctx.fillStyle = "#080b0f"
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const wash = ctx.createRadialGradient(350, 700, 20, 350, 700, 680)
  wash.addColorStop(0, `${accent}20`); wash.addColorStop(0.52, `${accent}0a`); wash.addColorStop(1, "#080b0f00")
  ctx.fillStyle = wash; ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.save()
  ctx.globalAlpha = 0.045
  ctx.strokeStyle = "#d6e0e8"
  ctx.lineWidth = 1
  for (let x = -20; x <= WIDTH; x += 54) { ctx.beginPath(); ctx.moveTo(x, 175); ctx.lineTo(x, 1080); ctx.stroke() }
  for (let y = 175; y <= 1080; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke() }
  ctx.restore()

  // Low-contrast terrain contours keep the frame cinematic without competing with the route.
  ctx.save()
  ctx.globalAlpha = 0.1
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.2
  for (let index = 0; index < 12; index++) {
    const offset = index * 28 + Math.sin(elapsed / 1300 + index) * 5
    ctx.beginPath()
    ctx.moveTo(-90, 455 + offset)
    ctx.bezierCurveTo(120, 360 + offset * 0.52, 510, 560 + offset * 0.2, 820, 420 + offset)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-80, 940 - offset)
    ctx.bezierCurveTo(160, 1080 - offset * 0.55, 530, 850 - offset * 0.2, 810, 1020 - offset)
    ctx.stroke()
  }
  ctx.restore()

  ctx.globalAlpha = reveal
  ctx.fillStyle = `${accent}20`
  ctx.beginPath(); ctx.roundRect(44, 48, 94, 42, 21); ctx.fill()
  ctx.font = "700 22px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  ctx.fillStyle = accent; ctx.fillText(event.series, 66, 77)

  ctx.font = "600 18px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  ctx.fillStyle = "#91a0ad"
  ctx.fillText(`${metadata.year}  /  ROUND ${String(event.round).padStart(2, "0")}`, 158, 76)
  ctx.textAlign = "right"
  ctx.fillStyle = "#71808d"
  ctx.fillText("TRACK FLIGHT", 676, 76)
  ctx.textAlign = "left"

  fitText(ctx, event.name, 44, 166, 632, 44, "#f5f7f8", 760)
  ctx.font = "400 20px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  ctx.fillStyle = "#aab5bf"
  ctx.fillText(`${event.locality} · ${event.country}`, 46, 207)
  ctx.font = "500 15px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  ctx.fillStyle = route.source === "public-reference" ? "#aab5bf" : `${accent}cc`
  ctx.fillText(route.sourceLabel, 46, 246)

  const marker = pointAt(points, Math.min(0.995, progress), routeLengths, routeLength)
  const driftX = Math.sin(elapsed / 1200) * 5
  const driftY = Math.cos(elapsed / 1550) * 4
  ctx.save()
  ctx.translate(driftX, driftY)

  // Track edge, asphalt, center paint, then the moving flight trace.
  ctx.save(); ctx.shadowColor = `${accent}66`; ctx.shadowBlur = 24
  ctx.strokeStyle = "#27313b"; ctx.lineWidth = 34; ctx.lineJoin = "round"; ctx.lineCap = "round"
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) ctx.lineTo(point.x, point.y); if (route.closed) ctx.closePath(); ctx.stroke()
  ctx.restore()
  ctx.strokeStyle = "#151b21"; ctx.lineWidth = 25; ctx.lineJoin = "round"; ctx.lineCap = "round"
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) ctx.lineTo(point.x, point.y); if (route.closed) ctx.closePath(); ctx.stroke()
  ctx.strokeStyle = "#59636c"; ctx.lineWidth = 2; ctx.setLineDash([8, 13]); ctx.lineJoin = "round"; ctx.lineCap = "round"
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) ctx.lineTo(point.x, point.y); if (route.closed) ctx.closePath(); ctx.stroke(); ctx.setLineDash([])

  traceRoute(ctx, points, marker.total * progress, marker.lengths)
  ctx.save(); ctx.shadowColor = accent; ctx.shadowBlur = 18; ctx.strokeStyle = accent; ctx.globalAlpha = 0.94; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.stroke(); ctx.restore()

  // Sector pins are placed along the route; rally stages stay point-to-point.
  for (let index = 0; index < 3; index++) {
    const pin = pointAt(points, (index + 1) / 4, routeLengths, routeLength)
    ctx.fillStyle = "#080b0f"; ctx.strokeStyle = `${accent}b0`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(pin.x, pin.y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.font = "700 9px Geist, sans-serif"; ctx.fillStyle = "#e8edf1"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(String(index + 1).padStart(2, "0"), pin.x, pin.y + 0.5)
  }

  // The start beacon and its expanding ring.
  const start = points[0]
  const pulse = (elapsed % 1550) / 1550
  ctx.save(); ctx.globalAlpha = 0.72 * (1 - pulse); ctx.strokeStyle = accent; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(start.x, start.y, 10 + pulse * 25, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(start.x, start.y, 5, 0, Math.PI * 2); ctx.fill()

  // Short prop-wash streaks emphasize speed without shaking the frame.
  for (let streak = 0; streak < 5; streak++) {
    const behind = clamp(progress - 0.012 * (streak + 1), 0, 1)
    const point = pointAt(points, behind, routeLengths, routeLength)
    ctx.globalAlpha = (1 - streak / 6) * 0.45
    ctx.strokeStyle = accent; ctx.lineWidth = 2 + (5 - streak) * 0.4
    ctx.beginPath(); ctx.moveTo(point.x - Math.cos(point.angle) * 18, point.y - Math.sin(point.angle) * 18); ctx.lineTo(point.x, point.y); ctx.stroke()
  }
  ctx.globalAlpha = 1
  drawDrone(ctx, marker.x, marker.y, marker.angle, accent, elapsed)
  ctx.restore()

  // Flight HUD
  ctx.globalAlpha = reveal
  ctx.fillStyle = "#ffffff08"; ctx.beginPath(); ctx.roundRect(44, 1000, 632, 126, 20); ctx.fill()
  ctx.strokeStyle = "#ffffff12"; ctx.lineWidth = 1; ctx.stroke()
  ctx.font = "500 13px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#778490"
  ctx.fillText("比赛日期 · 当地", 68, 1036)
  ctx.fillText("发车时间 · 北京", 360, 1036)
  ctx.font = "650 21px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#ecf0f3"
  ctx.fillText(metadata.date, 68, 1074)
  fitText(ctx, metadata.beijingTime, 360, 1074, 286, 20, metadata.uncertain ? "#aab5bf" : "#ecf0f3", 650)

  ctx.font = "500 13px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#66727d"
  ctx.fillText("跟随赛道，飞向下一场", 46, 1190)
  ctx.textAlign = "right"; ctx.fillStyle = "#66727d"; ctx.fillText("赛道时刻", 674, 1190); ctx.textAlign = "left"

  const closing = cubicOut(clamp((elapsed - DURATION_MS + 1700) / 1400, 0, 1))
  if (closing > 0) {
    ctx.globalAlpha = closing * 0.9
    const fade = ctx.createLinearGradient(0, 1130, 0, HEIGHT)
    fade.addColorStop(0, "#080b0f00"); fade.addColorStop(1, "#080b0f")
    ctx.fillStyle = fade; ctx.fillRect(0, 1120, WIDTH, 160)
    ctx.textAlign = "center"; ctx.font = "600 17px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#f4f6f8"
    ctx.fillText("下一站，现场见", WIDTH / 2, 1214); ctx.textAlign = "left"
  }
}

function chooseMimeType() {
  if (typeof MediaRecorder === "undefined") return ""
  return [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].find(type => MediaRecorder.isTypeSupported(type)) ?? ""
}

export function TrackFlightShare({ event }: { event: RaceEvent }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordStartRef = useRef(0)
  const visibleRef = useRef(true)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoType, setVideoType] = useState("")
  const [error, setError] = useState<string | null>(null)
  const route = useMemo(() => getTrackFlightRoute(event), [event])
  const main = mainSession(event)
  const points = useMemo(() => mapRoute(route.points), [route])
  const metrics = useMemo(() => routeMetrics(points), [points])
  const metadata = useMemo(() => {
    const uncertain = !main || isTimeUnconfirmed(event, main)
    return {
      year: main?.utc.slice(0, 4) ?? String(new Date().getFullYear()),
      date: main ? formatDate(main.utc, event.tz) : "赛程待公布",
      beijingTime: main && !uncertain ? formatDateTime(main.utc, BEIJING_TZ) : "具体场次时间待确认",
      uncertain,
    }
  }, [event, main])
  const videoFileName = `${event.id}-track-flight.${videoType.includes("mp4") ? "mp4" : "webm"}`

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting }, { threshold: 0.05 })
    observer.observe(canvas)
    let frame = 0
    const previewStarted = performance.now()
    const tick = (now: number) => {
      if (visibleRef.current || recorderRef.current?.state === "recording") {
        const recording = recorderRef.current?.state === "recording"
        const elapsed = recording ? now - recordStartRef.current : (now - previewStarted) % DURATION_MS
        drawFrame(canvas, event, route, points, metrics.lengths, metrics.total, metadata, elapsed)
        if (recording) {
          const nextProgress = Math.min(100, Math.floor(elapsed / DURATION_MS * 100))
          setProgress(current => current === nextProgress ? current : nextProgress)
          if (elapsed >= DURATION_MS) recorderRef.current?.stop()
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      recorderRef.current?.state === "recording" && recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [event, metadata, metrics, points, route])

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }, [videoUrl])

  const record = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
      setError("此浏览器暂不支持视频录制，可使用赛事分享卡片。")
      return
    }
    const mimeType = chooseMimeType()
    if (!mimeType) {
      setError("此浏览器没有可用的视频编码格式。请更新浏览器后重试。")
      return
    }
    setError(null)
    setProgress(0)
    setVideoUrl(null)
    try {
      const stream = canvas.captureStream(FPS)
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 })
      const chunks: BlobPart[] = []
      recorderRef.current = recorder
      streamRef.current = stream
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => {
        setError("录制中断，请关闭其他占用较多资源的页面后重试。")
        setRecording(false)
        stream.getTracks().forEach(track => track.stop())
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] || "video/webm" })
        if (!blob.size) {
          setError("视频文件未能生成，请重试。")
        } else {
          setVideoType(mimeType)
          setVideoUrl(URL.createObjectURL(blob))
          setProgress(100)
        }
        setRecording(false)
        stream.getTracks().forEach(track => track.stop())
      }
      recordStartRef.current = performance.now()
      setRecording(true)
      recorder.start(250)
    } catch (cause) {
      setRecording(false)
      setError(cause instanceof Error ? cause.message : "无法开始录制，请重试。")
    }
  }, [])

  const download = useCallback(() => {
    if (videoUrl) downloadFile(videoUrl, videoFileName)
  }, [videoFileName, videoUrl])

  const share = useCallback(async () => {
    if (!videoUrl) return
    const blob = await fetch(videoUrl).then(response => response.blob())
    const file = new File([blob], videoFileName, { type: blob.type })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: `${event.name} · 赛道飞行`, files: [file] }) }
      catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError("系统分享没有完成，可直接下载视频。") }
    } else {
      download()
      setError("此浏览器不支持直接分享视频，已改为下载文件。")
    }
  }, [download, event.name, videoFileName, videoUrl])

  return (
    <section className="mt-5 space-y-3" aria-labelledby={`track-flight-title-${event.id}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id={`track-flight-title-${event.id}`} className="text-sm font-medium">赛道飞行短片</h3>
          <p className="mt-1 text-xs text-muted-foreground">8.5 秒竖屏航拍动画，可下载或分享；{route.sourceLabel}。</p>
        </div>
        {!videoUrl && (
          <button type="button" onClick={record} disabled={recording} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
            {recording ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Video className="size-4" aria-hidden="true" />}
            {recording ? `正在录制 ${progress}%` : "生成视频"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-border p-3 sm:p-4">
        <div className="w-[108px] shrink-0 overflow-hidden rounded-lg bg-[#080b0f] sm:w-[144px]">
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block aspect-[9/16] h-auto w-full" aria-label={`${event.name}赛道飞行短片预览`} />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm font-medium">{event.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{event.locality} · {event.country} · {SERIES_META[event.series].full}</p>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">{route.source === "public-reference" ? "轮廓参考公开赛道几何数据，仅用于视觉呈现。" : "尚无可匹配的公开赛道轨迹，使用标注过的路线示意，不代表真实赛段走向。"}</p>
          {main && <p className="mt-2 text-xs text-muted-foreground">{isTimeUnconfirmed(event, main) ? "场次时间待确认" : formatDateTime(main.utc, BEIJING_TZ)}</p>}
          {recording && <div className="mt-4 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} /></div>}
          {error && <p role="status" className="mt-3 text-xs text-amber-500">{error}</p>}
          {videoUrl && (
            <div className="mt-4 space-y-3">
              <video src={videoUrl} controls playsInline className="max-h-[360px] w-full max-w-[190px] rounded-lg bg-black" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"><Download className="size-3.5" aria-hidden="true" />下载视频</button>
                <button type="button" onClick={() => void share()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"><Share2 className="size-3.5" aria-hidden="true" />分享视频</button>
                <button type="button" onClick={record} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary">重新生成</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
