"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { LoaderKind } from "@/components/interface-motion"
import type { ReactNode } from "react"
import { LoadingState, EmptyState } from "./primitives"

export function SimplePageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <header className="s-page-header"><Link href="/new" className="s-icon" aria-label="返回新版首页"><ArrowLeft size={17} aria-hidden="true" /></Link><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="s-page-action">{action}</div>}</header>
}
export function SimpleTabs<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className="s-tabs" role="group" aria-label={label}>{options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>
}
export function DataState({ loading, loadingKind = "schedule", error, empty, retry, children }: { loading?: boolean; loadingKind?: LoaderKind; error?: Error | string; empty?: boolean; retry?: () => void; children: ReactNode }) {
  if (loading) return <LoadingState kind={loadingKind} />
  if (error) return <div className="s-error" role="alert"><p>{typeof error === "string" ? error : error.message}</p>{retry && <button type="button" className="s-button" onClick={retry}>重试</button>}</div>
  if (empty) return <EmptyState title="暂无数据" description="当前条件下还没有可用记录，可调整筛选或稍后重试。" />
  return <>{children}</>
}
export type TableColumn<T> = { key: string; title: string; render: (row: T) => ReactNode }
export function SimpleTable<T>({ caption, columns, rows, rowKey }: { caption: string; columns: TableColumn<T>[]; rows: T[]; rowKey: (row: T, index: number) => string }) {
  return <div className="s-table-wrap" tabIndex={0} aria-label={`${caption}，窄屏可横向滚动`}><table className="s-table"><caption className="sr-only">{caption}</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.title}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={rowKey(row, index)}>{columns.map(column => <td key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>
}
export function SimpleBarChart({ rows, label }: { rows: { name: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map(row => row.value))
  return <figure className="s-bar-chart"><figcaption>{label}</figcaption>{rows.slice(0, 10).map((row, index) => <div key={`${row.name}-${index}`}><span>{row.name}</span><i aria-hidden="true"><b style={{ width: `${Math.max(0, row.value) / max * 100}%` }} /></i><strong>{row.value}</strong></div>)}</figure>
}
export function SimpleSection({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return <section className="s-section"><h2>{title}</h2>{description && <p className="s-note">{description}</p>}{children}</section>
}
