import type { ScheduleResponse } from "@/lib/types"
import { formatDateTime, BEIJING_TZ } from "@/lib/format"

export function SimpleSourceStatus({ data, error }: { data?: ScheduleResponse; error?: boolean }) {
  const offline = data && "offline" in data && data.offline
  const degraded = data?.sources.some(source => !source.ok || source.cached)
  return <details className="s-source"><summary><i data-warning={!!(offline || degraded || error) || undefined} aria-hidden="true" />{error && !data ? "连接失败" : !data ? "正在连接赛历" : offline ? "离线 · 上次赛历" : degraded ? "部分系列使用缓存或暂不可用" : "赛历已更新"}<span>时间均为北京时间</span></summary><div>{data?.sources.map(source => <p key={source.series}><b>{source.series}</b> {source.label}{source.cached ? " · 本机缓存" : !source.ok ? " · 暂不可用" : ""}{source.note ? ` · ${source.note}` : ""}</p>)}{data && Number.isFinite(Date.parse(data.fetchedAt)) && <p>数据时间：{formatDateTime(data.fetchedAt, BEIJING_TZ)}</p>}<p>倒计时依据赛程，非现场发车信号；时间待确认及待核验场次不触发倒计时。</p></div></details>
}
