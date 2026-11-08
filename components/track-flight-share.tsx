"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { gsap } from "gsap"
import { Download, LoaderCircle, Share2, Video } from "lucide-react"
import type { RaceEvent } from "@/lib/types"
import { BEIJING_TZ, SERIES_META, formatDate, formatDateTime, mainSession } from "@/lib/format"
import { isTimeUnconfirmed } from "@/lib/session-time"
import { downloadFile } from "@/lib/download"
import { getTrackFlightRoute } from "@/lib/track-flight"
import { pointAtDistance, prepareTrackDrawing, smoothedPointAtDistance, smoothstep, type TrackDrawing } from "@/lib/track-flight-drawing"

const WIDTH = 720
const HEIGHT = 1280
const DURATION_MS = 22_000
const INTRO_DURATION_MS = 2_400
const DRAW_DURATION_MS = 15_400
const CAMERA_PULLBACK_MS = 2_500
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

function drawOverlay(canvas: HTMLCanvasElement, event: RaceEvent, route: ReturnType<typeof getTrackFlightRoute>, track: TrackDrawing, metadata: { year: string; date: string; beijingTime: string; uncertain: boolean }, elapsed: number, drawingProgress: number) {
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) return
  const accent = COLORS[event.series]
  const drawProgress = clamp(drawingProgress, 0, 1)
  const introProgress = smoothstep(elapsed / INTRO_DURATION_MS)
  const drawingEndsAt = INTRO_DURATION_MS + DRAW_DURATION_MS
  const cameraPullback = smoothstep((elapsed - drawingEndsAt) / CAMERA_PULLBACK_MS)
  const reveal = smoothstep((elapsed - drawingEndsAt - CAMERA_PULLBACK_MS + 250) / 850)
  const tip = pointAtDistance(track, track.length * drawProgress)
  const followZoom = Math.max(track.fitScale * 11.5, 2.6)
  const zoomIn = track.fitScale + (followZoom - track.fitScale) * introProgress
  const zoom = zoomIn + (track.fitScale - zoomIn) * cameraPullback
  const followCenter = smoothedPointAtDistance(
    track,
    track.length * drawProgress - Math.min(28, track.length * 0.012),
    108,
  )
  const zoomCenter = {
    x: track.center.x + (followCenter.x - track.center.x) * introProgress,
    y: track.center.y + (followCenter.y - track.center.y) * introProgress,
  }
  const cameraCenter = {
    x: zoomCenter.x + (track.center.x - zoomCenter.x) * cameraPullback,
    y: zoomCenter.y + (track.center.y - zoomCenter.y) * cameraPullback,
  }
  const viewCenterY = 520 + 100 * introProgress - 100 * cameraPullback
  const toScreen = (point: { x: number; y: number }) => ({
    x: WIDTH / 2 + (point.x - cameraCenter.x) * zoom,
    y: viewCenterY - (point.y - cameraCenter.y) * zoom,
  })

  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  background.addColorStop(0, "#05070d")
  background.addColorStop(0.52, "#101722")
  background.addColorStop(1, "#04060a")
  ctx.fillStyle = background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const accentWash = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.56, 20, WIDTH / 2, HEIGHT * 0.56, HEIGHT * 0.68)
  accentWash.addColorStop(0, `${accent}24`)
  accentWash.addColorStop(1, `${accent}00`)
  ctx.fillStyle = accentWash
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Draw the grid in track coordinates so it stays anchored to the route as the camera moves.
  ctx.save()
  ctx.lineWidth = 1
  const minorGrid = 24
  const majorGrid = minorGrid * 5
  const leftWorld = cameraCenter.x - WIDTH / (2 * zoom)
  const rightWorld = cameraCenter.x + WIDTH / (2 * zoom)
  const topWorld = cameraCenter.y + viewCenterY / zoom
  const bottomWorld = cameraCenter.y + (viewCenterY - HEIGHT) / zoom
  const gridOrigin = track.points[0] ?? { x: 0, y: 0 }
  const firstGridX = gridOrigin.x + Math.floor((leftWorld - gridOrigin.x) / minorGrid) * minorGrid
  const lastGridX = gridOrigin.x + Math.ceil((rightWorld - gridOrigin.x) / minorGrid) * minorGrid
  for (let x = firstGridX; x <= lastGridX; x += minorGrid) {
    const screenX = toScreen({ x, y: cameraCenter.y }).x
    const major = Math.abs((x - gridOrigin.x) % majorGrid) < 0.001
    ctx.strokeStyle = major ? `${accent}20` : "#dbeafe0c"
    ctx.beginPath(); ctx.moveTo(screenX + 0.5, 0); ctx.lineTo(screenX + 0.5, HEIGHT); ctx.stroke()
  }
  const firstGridY = gridOrigin.y + Math.floor((bottomWorld - gridOrigin.y) / minorGrid) * minorGrid
  const lastGridY = gridOrigin.y + Math.ceil((topWorld - gridOrigin.y) / minorGrid) * minorGrid
  for (let y = firstGridY; y <= lastGridY; y += minorGrid) {
    const screenY = toScreen({ x: cameraCenter.x, y }).y
    const major = Math.abs((y - gridOrigin.y) % majorGrid) < 0.001
    ctx.strokeStyle = major ? `${accent}20` : "#dbeafe0c"
    ctx.beginPath(); ctx.moveTo(0, screenY + 0.5); ctx.lineTo(WIDTH, screenY + 0.5); ctx.stroke()
  }
  ctx.restore()

  const visibleDistance = track.length * drawProgress
  const start = track.points[0]
  const startNext = track.points[1] ?? start
  const startDx = startNext.x - start.x
  const startDy = startNext.y - start.y
  const startLength = Math.max(Math.hypot(startDx, startDy), 0.001)
  const startSide = { x: -startDy / startLength * 25, y: startDx / startLength * 25 }
  const startA = toScreen({ x: start.x - startSide.x, y: start.y - startSide.y })
  const startB = toScreen({ x: start.x + startSide.x, y: start.y + startSide.y })

  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = "#f4f6f8"
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.88
  ctx.beginPath(); ctx.moveTo(startA.x, startA.y); ctx.lineTo(startB.x, startB.y); ctx.stroke()

  if (drawProgress > 0) {
    ctx.beginPath()
    const firstScreen = toScreen(track.points[0])
    ctx.moveTo(firstScreen.x, firstScreen.y)
    for (let index = 1; index < track.points.length && track.distances[index] < visibleDistance; index++) {
      const point = toScreen(track.points[index])
      ctx.lineTo(point.x, point.y)
    }
    const tipScreen = toScreen(tip)
    ctx.lineTo(tipScreen.x, tipScreen.y)
    if (drawProgress >= 1 && track.closed) ctx.closePath()
    ctx.globalAlpha = 1
    ctx.strokeStyle = accent
    ctx.lineWidth = 5.5
    ctx.shadowColor = accent
    ctx.shadowBlur = 20
    ctx.stroke()
    ctx.shadowBlur = 0

    if (drawProgress < 1 && elapsed >= INTRO_DURATION_MS && reveal === 0) {
      ctx.beginPath()
      ctx.arc(tipScreen.x, tipScreen.y, 5.5, 0, Math.PI * 2)
      ctx.fillStyle = "#ffffff"
      ctx.shadowColor = accent
      ctx.shadowBlur = 18
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  const titleMorph = smoothstep(elapsed / 1_050)
  const titleOpacity = 1 - smoothstep((elapsed - 150) / 1_050)
  if (titleOpacity > 0) {
    const startScreen = toScreen(track.points[0] ?? { x: 0, y: 0 })
    const titleX = WIDTH / 2 + (startScreen.x - WIDTH / 2) * titleMorph
    const titleY = 500 + (startScreen.y - 500) * titleMorph
    ctx.save()
    ctx.globalAlpha = titleOpacity
    ctx.filter = `blur(${titleMorph * 12}px)`
    ctx.translate(titleX, titleY)
    ctx.scale(1 - titleMorph * 0.995, 1 - titleMorph * 0.995)
    ctx.textAlign = "center"
    ctx.fillStyle = accent
    ctx.font = "700 17px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    ctx.fillText(`${event.series}  /  ROUND ${String(event.round).padStart(2, "0")}`, 0, -40)
    fitText(ctx, event.name, 0, 12, WIDTH - 80, 46, "#ffffff", 760)
    ctx.font = "400 18px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    ctx.fillStyle = "#dce2e5"
    ctx.fillText(`${event.locality} · ${event.country}`, 0, 50)
    ctx.restore()
    ctx.filter = "none"
    ctx.textAlign = "left"
  }

  const penReveal = smoothstep(elapsed / 320)
  const penExit = smoothstep((elapsed - INTRO_DURATION_MS + 160) / 180)
  const penOpacity = penReveal * (1 - penExit)
  if (penOpacity > 0 && reveal === 0) {
    const pen = toScreen(track.points[0] ?? { x: 0, y: 0 })
    ctx.globalAlpha = penOpacity
    ctx.beginPath()
    ctx.arc(pen.x, pen.y, 3.2, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.shadowColor = accent
    ctx.shadowBlur = 16
    ctx.fill()
    ctx.shadowBlur = 0
  }

  if (reveal > 0) {
    ctx.globalAlpha = reveal
    ctx.fillStyle = `${accent}e8`
    ctx.beginPath(); ctx.roundRect(44, 894, 88, 38, 19); ctx.fill()
    ctx.font = "700 20px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    ctx.fillStyle = "#ffffff"; ctx.fillText(event.series, 63, 920)
    ctx.font = "600 15px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    ctx.fillStyle = "#ffffffb8"; ctx.fillText(`${metadata.year}  /  ROUND ${String(event.round).padStart(2, "0")}`, 148, 919)
    ctx.textAlign = "right"; ctx.fillText("ROUTE COMPLETE", 676, 919); ctx.textAlign = "left"
    fitText(ctx, event.name, 44, 988, 632, 44, "#ffffff", 760)
    ctx.font = "400 19px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    ctx.fillStyle = "#dce2e5"; ctx.fillText(`${event.locality} · ${event.country}`, 46, 1028)
    ctx.font = "500 15px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    ctx.fillStyle = "#ffffffb8"; ctx.fillText(`当地时间 · ${metadata.date}`, 46, 1074)
    ctx.fillStyle = metadata.uncertain ? "#ffffffb8" : "#ffffff"
    fitText(ctx, `北京时间 · ${metadata.beijingTime}`, 46, 1110, 620, 15, metadata.uncertain ? "#ffffffb8" : "#ffffff", 500)
    ctx.font = "500 13px Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"; ctx.fillStyle = "#ffffff88"
    ctx.fillText(`${route.sourceLabel} · 仅作视觉参考`, 46, 1184)
    ctx.textAlign = "right"; ctx.fillText("赛道时刻", 674, 1184); ctx.textAlign = "left"
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

function addAmbientScore(context: AudioContext, destination: MediaStreamAudioDestinationNode) {
  const now = context.currentTime
  const filter = context.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.setValueAtTime(360, now)
  filter.frequency.linearRampToValueAtTime(2_400, now + DURATION_MS / 1000)
  filter.Q.value = 0.55

  const master = context.createGain()
  master.gain.setValueAtTime(0.0008, now)
  master.gain.linearRampToValueAtTime(0.2, now + DURATION_MS / 1000)
  filter.connect(master)
  master.connect(destination)

  const addVoice = (options: {
    frequency: number
    start: number
    hold: number
    attack: number
    release: number
    volume: number
    type?: OscillatorType
    detune?: number
  }) => {
    const oscillator = context.createOscillator()
    const level = context.createGain()
    oscillator.type = options.type ?? "sine"
    oscillator.frequency.setValueAtTime(options.frequency, options.start)
    if (options.detune) oscillator.detune.setValueAtTime(options.detune, options.start)
    const peak = Math.max(options.volume, 0.0002)
    level.gain.setValueAtTime(0.0001, options.start)
    level.gain.exponentialRampToValueAtTime(peak, options.start + options.attack)
    level.gain.setValueAtTime(peak, options.start + options.attack + options.hold)
    level.gain.exponentialRampToValueAtTime(0.0001, options.start + options.attack + options.hold + options.release)
    oscillator.connect(level)
    level.connect(filter)
    oscillator.start(options.start)
    oscillator.stop(options.start + options.attack + options.hold + options.release + 0.03)
  }

  const seconds = DURATION_MS / 1_000
  const chordProgression = [
    [73.42, 146.83, 220, 293.66, 349.23],
    [58.27, 116.54, 174.61, 233.08, 293.66],
    [87.31, 174.61, 220, 261.63, 349.23],
    [65.41, 130.81, 196, 261.63, 349.23],
    [73.42, 146.83, 220, 293.66, 349.23],
  ]
  const chordLength = seconds / chordProgression.length
  chordProgression.forEach((chord, chordIndex) => {
    const start = now + chordIndex * chordLength
    const hold = chordLength + 0.45
    for (const [noteIndex, frequency] of chord.entries()) {
      const weight = noteIndex === 0 ? 0.14 : noteIndex < 3 ? 0.055 : 0.035
      addVoice({ frequency, start, hold, attack: 0.75, release: 0.85, volume: weight, type: "triangle" })
      if (noteIndex > 0) addVoice({ frequency: frequency * 1.003, start, hold, attack: 1.1, release: 0.9, volume: weight * 0.22, type: "sine", detune: -4 })
    }
  })

  const motif = [293.66, 440, 523.25, 587.33, 523.25, 440, 392, 349.23, 392, 440, 587.33, 698.46]
  let beat = 0
  for (let time = 0.55; time < seconds - 0.2; beat++) {
    const intensity = 0.025 + 0.075 * (time / seconds)
    const pulse = 0.72 - 0.27 * (time / seconds)
    const note = motif[(beat * 5 + Math.floor(time / chordLength) * 3) % motif.length]
    addVoice({ frequency: note, start: now + time, hold: 0.035, attack: 0.012, release: 0.19, volume: intensity, type: beat % 4 === 2 ? "sine" : "triangle" })

    if (beat % 2 === 0) {
      const thump = context.createOscillator()
      const thumpLevel = context.createGain()
      const thumpTime = now + time
      thump.type = "sine"
      thump.frequency.setValueAtTime(92 - 18 * (time / seconds), thumpTime)
      thump.frequency.exponentialRampToValueAtTime(42, thumpTime + 0.16)
      thumpLevel.gain.setValueAtTime(0.0001, thumpTime)
      thumpLevel.gain.exponentialRampToValueAtTime(0.09 + 0.08 * (time / seconds), thumpTime + 0.012)
      thumpLevel.gain.exponentialRampToValueAtTime(0.0001, thumpTime + 0.25)
      thump.connect(thumpLevel)
      thumpLevel.connect(filter)
      thump.start(thumpTime)
      thump.stop(thumpTime + 0.28)
    }
    time += pulse
  }
}

export function TrackFlightShare({ event }: { event: RaceEvent }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const recordStartRef = useRef(0)
  const previewStartRef = useRef(0)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const visibleRef = useRef(true)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoType, setVideoType] = useState("")
  const [error, setError] = useState<string | null>(null)
  const route = useMemo(() => getTrackFlightRoute(event), [event])
  const track = useMemo(() => prepareTrackDrawing(route), [route])
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
    const playhead = { value: 0 }
    const timeline = gsap.timeline({ repeat: -1, onRepeat: () => { playhead.value = 0 } })
    timeline
      .to(playhead, { value: 0, duration: INTRO_DURATION_MS / 1000, ease: "none" })
      .to(playhead, { value: 1, duration: DRAW_DURATION_MS / 1000, ease: "power1.inOut" })
      .to(playhead, { value: 1, duration: (DURATION_MS - INTRO_DURATION_MS - DRAW_DURATION_MS) / 1000, ease: "none" })
    timelineRef.current = timeline
    let frame = 0
    previewStartRef.current = performance.now()
    const tick = (now: number) => {
      const isRecording = recorderRef.current?.state === "recording"
      if (visibleRef.current || isRecording) {
        const elapsed = isRecording ? now - recordStartRef.current : (now - previewStartRef.current) % DURATION_MS
        drawOverlay(canvas, event, route, track, metadata, elapsed, playhead.value)
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
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [event, metadata, route, track])

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }, [videoUrl])

  const record = useCallback(async () => {
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
    if (typeof window.AudioContext !== "function") {
      setError("此浏览器不支持氛围音乐合成，无法生成带音乐的视频。")
      return
    }
    setError(null)
    setProgress(0)
    setVideoUrl(null)
    let videoStream: MediaStream | null = null
    let recordingStream: MediaStream | null = null
    try {
      videoStream = canvas.captureStream(FPS)
      const audioContext = new window.AudioContext()
      audioContextRef.current = audioContext
      await audioContext.resume()
      const destination = audioContext.createMediaStreamDestination()
      addAmbientScore(audioContext, destination)
      const audioTracks = destination.stream.getAudioTracks()
      recordingStream = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks])
      const recorder = new MediaRecorder(recordingStream, { mimeType, videoBitsPerSecond: 5_000_000 })
      const chunks: BlobPart[] = []
      recorderRef.current = recorder
      streamRef.current = recordingStream
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => {
        setError("录制中断，请关闭其他占用较多资源的页面后重试。")
        setRecording(false)
        recordingStream?.getTracks().forEach(track => track.stop())
        videoStream?.getTracks().forEach(track => track.stop())
        void audioContextRef.current?.close()
        audioContextRef.current = null
        previewStartRef.current = performance.now()
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
        recordingStream?.getTracks().forEach(track => track.stop())
        videoStream?.getTracks().forEach(track => track.stop())
        void audioContextRef.current?.close()
        audioContextRef.current = null
        previewStartRef.current = performance.now()
        timelineRef.current?.repeat(-1).restart()
      }
      timelineRef.current?.repeat(0).restart()
      recordStartRef.current = performance.now()
      previewStartRef.current = recordStartRef.current
      setRecording(true)
      recorder.start(250)
    } catch (cause) {
      setRecording(false)
      recordingStream?.getTracks().forEach(track => track.stop())
      videoStream?.getTracks().forEach(track => track.stop())
      void audioContextRef.current?.close()
      audioContextRef.current = null
      previewStartRef.current = performance.now()
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
          <p className="mt-1 text-xs text-muted-foreground">22 秒竖屏描线短片：赛事标题化作笔尖，镜头跟随赛道线，氛围音乐渐强后显示赛事信息。</p>
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
