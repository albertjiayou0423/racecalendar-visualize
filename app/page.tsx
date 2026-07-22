import { ScheduleView } from "@/components/schedule-view"

export default function Page() {
  const serverTime = Date.now()
  return (
    <main className="min-h-dvh">
      <ScheduleView serverTime={serverTime} />
    </main>
  )
}
