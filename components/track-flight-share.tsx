"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { gsap } from "gsap"
import { Download, LoaderCircle, Share2, Video } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, formatDate, formatDateTime, mainSession } from "@/lib/format"
import { isTimeUnconfirmed } from "@/lib/session-time"
import { downloadFile } from "@/lib/download"
import { getTrackFlightRoute } from "@/lib/track-flight"
import { createTrackFlightScene, disposeTrackFlightScene, renderTrackFlightFrame } from "@/lib/track-flight-scene"

const WIDTH = 720
const HEIGHT = 1280
const DURATION_MS = 22_000
const FPS = 30

const COLORS: Record<RaceEvent["series"], string> = {
  F1: "#ef4444",
  WRC: "#2f91ec",
  FE: "#22c55e",
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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

function drawOverlay(canvas: HTMLCanvasElement, sceneCanvas: HTMLCanvasElement, event: RaceEvent, route: ReturnType<typeof getTrackFlightRoute>, metadata: { year: string; date: string; beijingTime: string; uncertain: boolean }, elapsed: number) {
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) return
  const accent = COLORS[event.series]
  const progress = clamp(elapsed / DURATION_MS, 0, 1)
  const reveal = clamp(elapsed / 900, 0, 1)

  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  ctx.drawImage(sceneCanvas, 0, 0, WIDTH, HEIGHT)

  const topShade = ctx.createLinearGradient(0, 0, 0, 310)
  topShade.addColorStop(0, "#070a0dcc")
  topShade.addColorStop(1, "#070a0d00")
  ctx.fillStyle = topShade
  ctx.fillRect(0, 0, WIDTH, 310)

  const bottomShade = ctx.createLinearGradient(0, 900, 0, HEIGHT)
  bottomShade.addColorStop(0, "#070a0d00")
  bottomShade.addColorStop(1, "#070a0df2")
  ctx.fillStyle = bottomShade
  ctx.fillRect(0, 900, WIDTH, HEIGHT - 900)

  ctx.globalAlpha = reveal
  ctx.fillStyle = `${accent}e8`
  ctx.beginPath(); ctx.roundRect(44, 48, 94, 42, 21); ctx.fill()
  ctx.font = "700 22px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  ctx.fillStyle = "#ffffff"; ctx.fillText(event.series, 66, 77)
  ctx.font = "600 18px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  ctx.fillStyle = "#e1e6e9"; ctx.fillText(`${metadata.year}  /  ROUND ${String(event.round).padStart(2, "0")}`, 158, 76)
  ctx.textAlign = "right"; ctx.fillStyle = "#ffffffb8"; ctx.fillText("AERIAL CAMERA", 676, 76); ctx.textAlign = "left"

  fitText(ctx, event.name, 44, 166, 632, 44, "#ffffff", 760)
  ctx.font = "400 20px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  ctx.fillStyle = "#edf1f2"; ctx.fillText(`${event.locality} · ${event.country}`, 46, 207)
  ctx.font = "500 15px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  ctx.fillStyle = "#ffffffc7"; ctx.fillText(route.sourceLabel, 46, 246)

  // Discreet camera reticle sits above the rendered 3D view, not on a map illustration.
  ctx.save(); ctx.globalAlpha = 0.48; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.moveTo(WIDTH / 2 - 17, 575); ctx.lineTo(WIDTH / 2 - 7, 575)
  ctx.moveTo(WIDTH / 2 + 7, 575); ctx.lineTo(WIDTH / 2 + 17, 575)
  ctx.moveTo(WIDTH / 2, 567); ctx.lineTo(WIDTH / 2, 572)
  ctx.arc(WIDTH / 2, 575, 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore()

  ctx.globalAlpha = reveal
  ctx.fillStyle = "#070a0d9c"; ctx.beginPath(); ctx.roundRect(38, 1008, 644, 130, 18); ctx.fill()
  ctx.strokeStyle = "#ffffff28"; ctx.lineWidth = 1; ctx.stroke()
  ctx.font = "500 13px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#d4dcdf"
  ctx.fillText("飞行速度", 62, 1040); ctx.fillText("镜头高度", 252, 1040); ctx.fillText("航向", 454, 1040)
  ctx.font = "650 22px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#ffffff"
  ctx.fillText(`${Math.round(21 + Math.sin(progress * Math.PI * 3) * 3)} km/h`, 62, 1078)
  ctx.fillText(`${event.series === "WRC" ? "9" : "10"} m`, 252, 1078)
  const heading = Math.floor((progress * 160 + event.round * 37) % 360)
  ctx.fillText(`${String(heading).padStart(3, "0")}°`, 454, 1078)
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(638, 1064, 5, 0, Math.PI * 2); ctx.fill()
  ctx.font = "600 12px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#ffffffd0"; ctx.fillText("REC", 650, 1068)
  ctx.font = "500 13px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#d4dcdf"
  ctx.fillText(`赛程日期 · ${metadata.date}`, 62, 1112)
  fitText(ctx, metadata.beijingTime, 252, 1112, 390, 13, metadata.uncertain ? "#b9c1c5" : "#ffffffd0", 500)

  ctx.font = "500 13px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#ffffffb0"
  ctx.fillText("无人机航拍视角 · 路线几何仅作视觉参考", 46, 1190)
  ctx.textAlign = "right"; ctx.fillText("赛道时刻", 674, 1190); ctx.textAlign = "left"

  const closing = clamp((elapsed - DURATION_MS + 2800) / 1800, 0, 1)
  if (closing > 0) {
    ctx.globalAlpha = closing * 0.96
    ctx.fillStyle = "#070a0d"
    ctx.fillRect(0, 1128, WIDTH, 152)
    ctx.textAlign = "center"; ctx.font = "600 17px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#ffffff"
    ctx.fillText("下一站，现场见", WIDTH / 2, 1214); ctx.textAlign = "left"
  }
  ctx.globalAlpha = 1
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
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const visibleRef = useRef(true)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoType, setVideoType] = useState("")
  const [error, setError] = useState<string | null>(null)
  const route = useMemo(() => getTrackFlightRoute(event), [event])
  const main = mainSession(event)
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
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) { setError("当前浏览器无法创建视频画布。"); return }
    const observer = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting }, { threshold: 0.05 })
    observer.observe(canvas)
    let flight: ReturnType<typeof createTrackFlightScene>
    try {
      flight = createTrackFlightScene(route, event.series, event.round)
    } catch (cause) {
      setError(cause instanceof Error ? `3D 画面初始化失败：${cause.message}` : "当前设备无法启动 3D 画面，请更新浏览器后重试。")
      observer.disconnect()
      return
    }
    const playhead = { value: 0 }
    const timeline = gsap.timeline({ repeat: -1, onRepeat: () => { playhead.value = 0 } })
    timeline.to(playhead, { value: 1, duration: DURATION_MS / 1000, ease: "sine.inOut" })
    timelineRef.current = timeline
    let frame = 0
    const previewStarted = performance.now()
    const tick = (now: number) => {
      const isRecording = recorderRef.current?.state === "recording"
      if (visibleRef.current || isRecording) {
        const elapsed = isRecording ? now - recordStartRef.current : (now - previewStarted) % DURATION_MS
        const rendered = renderTrackFlightFrame(flight, playhead.value)
        drawOverlay(canvas, rendered.canvas, event, route, metadata, elapsed)
        if (isRecording) {
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
      timeline.kill()
      if (timelineRef.current === timeline) timelineRef.current = null
      if (recorderRef.current?.state === "recording") recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      disposeTrackFlightScene(flight)
    }
  }, [event, metadata, route])

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
      timelineRef.current?.repeat(0).restart()
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
        timelineRef.current?.repeat(-1).restart()
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] || "video/webm" })
        if (!blob.size) setError("视频文件未能生成，请重试。")
        else {
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
      timelineRef.current?.repeat(-1).restart()
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
          <p className="mt-1 text-xs text-muted-foreground">22 秒竖屏 3D 无人机航拍，可下载或分享；{route.sourceLabel}。</p>
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
