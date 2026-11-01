import type { Metadata } from "next"
import { PendingMotionLab } from "@/components/pending-motion-lab"

export const metadata: Metadata = {
  title: "动效体验台 · 赛道时刻",
  description: "使用实际赛事日历与项目组件体验赛事仪式感动效。",
}

export default function PendingPage() {
  return <PendingMotionLab />
}
