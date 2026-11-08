import TogetherRoom from "@/components/together-room"

export default async function TogetherPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ at?: string; session?: string; from?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  return <TogetherRoom id={id} utc={query.at ?? ""} sessionName={query.session ?? ""} fromNew={query.from === "new"} />
}
