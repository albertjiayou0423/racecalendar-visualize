"use client"

import { useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { FeedbackForm } from "@/components/feedback-form"
import { Button } from "@/components/ui/button"

export function FeedbackButton() {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowForm(true)}
        className="gap-2"
      >
        <MessageSquarePlus className="size-4" />
        提建议 / 报 Bug
      </Button>
      {showForm && <FeedbackForm onClose={() => setShowForm(false)} />}
    </>
  )
}