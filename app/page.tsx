import { EditionRedirect } from "./new/components/edition-entry"
import { ScheduleView } from "@/components/schedule-view"

export default function Page() {
  const serverTime = Date.now()
  return (
    <main className="min-h-dvh">
      <EditionRedirect />
      <ScheduleView serverTime={serverTime} />
    </main>
  )
}
