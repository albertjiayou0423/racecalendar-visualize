import { notFound } from 'next/navigation'
import { ImmersionLabCase } from '@/components/immersion-lab'
import { immersionCases } from '@/lib/immersion-catalog'

export function generateStaticParams() { return immersionCases.map(item => ({ component: item.id })) }

export default async function ImmersionComponentPage({ params }: { params: Promise<{ component: string }> }) {
  const { component } = await params
  const item = immersionCases.find(entry => entry.id === component)
  if (!item) notFound()
  return <ImmersionLabCase id={item.id} fullscreen basePath="/new/playground" />
}
