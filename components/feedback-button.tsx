"use client"

import { MessageSquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"

const GITHUB_REPO = "albertjiayou0423/racecalendar-visualize"
const ISSUE_TEMPLATE = encodeURIComponent(`## 问题描述

请简要描述你遇到的问题或功能建议。

## 复现步骤（如果是 Bug）

1. 
2. 
3. 

## 预期行为

## 截图（可选）

## 其他信息

浏览器：
系统：
`)

export function FeedbackButton() {
  const issueUrl = `https://github.com/${GITHUB_REPO}/issues/new?title=Feature%20Request%20/%20Bug%20Report&body=${ISSUE_TEMPLATE}`

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open(issueUrl, "_blank", "noopener,noreferrer")}
      className="gap-2"
    >
      <MessageSquarePlus className="size-4" />
      提建议 / 报 Bug
    </Button>
  )
}