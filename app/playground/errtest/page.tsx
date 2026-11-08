import type { Metadata } from "next"
import ErrorTestLab from "@/components/error-test-lab"

export const metadata: Metadata = {
  title: "前端错误实验 | 赛道时刻",
  robots: { index: false, follow: false },
}

export default function ErrorTestPage() {
  return <ErrorTestLab />
}
