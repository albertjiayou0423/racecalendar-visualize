import type { Metadata } from "next"
import { DataFlowDashboard } from "@/components/data-flow-dashboard"

export const metadata: Metadata = {
  title: "数据流 · 赛道时刻",
  description: "实时查看赛事数据从公开来源到数据库和赛历页面的处理过程。",
}

export default function DataPage() {
  return <DataFlowDashboard />
}
