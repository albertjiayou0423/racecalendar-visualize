import { getSql } from "@/lib/db"
import { logServerError, logServerInfo, logServerWarn } from "@/lib/server-log"

type SeriesStatus = { series: "F1" | "FE" | "WRC"; ok: boolean }

let tablesReady = false

async function getNotificationSql() {
  const sql = getSql()
  if (!sql) throw new Error("Notification database is unavailable")
  if (!tablesReady) {
    await sql`
      CREATE TABLE IF NOT EXISTS notification_health_daily (
        day DATE NOT NULL,
        series TEXT NOT NULL,
        check_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, series)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS notification_incidents (
        incident_key TEXT PRIMARY KEY,
        last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS notification_monthly_reports (
        month TEXT PRIMARY KEY,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    tablesReady = true
  }
  return sql
}

function shanghaiDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "00"
  return `${part("year")}-${part("month")}-${part("day")}`
}

function previousMonthRange(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number)
  const start = new Date(Date.UTC(year, month - 2, 1))
  const end = new Date(Date.UTC(year, month - 1, 1))
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`
  return {
    key,
    start: `${key}-01`,
    end: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-01`,
  }
}

async function sendEmail(subject: string, text: string, html: string, idempotencyKey: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const to = process.env.ALERT_MAIL_TO
  if (!apiKey || !from || !to) throw new Error("Resend email environment is incomplete")

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    logServerError("notifications.email_send_failed", { provider: "resend", status: response.status })
    throw new Error(`Resend request failed with status ${response.status}`)
  }
}

export async function recordScheduleHealth(statuses: SeriesStatus[]) {
  try {
    const sql = await getNotificationSql()
    const day = shanghaiDate()
    await Promise.all(statuses.map(({ series, ok }) => sql`
      INSERT INTO notification_health_daily (day, series, check_count, failure_count)
      VALUES (${day}::date, ${series}, 1, ${ok ? 0 : 1})
      ON CONFLICT (day, series) DO UPDATE SET
        check_count = notification_health_daily.check_count + 1,
        failure_count = notification_health_daily.failure_count + ${ok ? 0 : 1}
    `))
  } catch (error) {
    logServerWarn("notifications.health_record_failed", {}, error)
  }
}

export async function sendScheduleIncidentAlert() {
  const incidentKey = "all-schedule-series-unavailable"
  try {
    const sql = await getNotificationSql()
    const claimed = await sql`
      INSERT INTO notification_incidents (incident_key, last_sent_at)
      VALUES (${incidentKey}, NOW())
      ON CONFLICT (incident_key) DO UPDATE SET last_sent_at = NOW()
      WHERE notification_incidents.last_sent_at < NOW() - INTERVAL '6 hours'
      RETURNING incident_key
    `
    if (!claimed.length) return

    await sendEmail(
      "赛道时刻：赛历服务异常",
      "F1、Formula E 和 WRC 的赛历数据目前都不可用，请检查 Vercel Runtime Logs 中的 api.schedule.series_unavailable。",
      "<p>F1、Formula E 和 WRC 的赛历数据目前都不可用。</p><p>请在 Vercel Runtime Logs 中搜索 <code>api.schedule.series_unavailable</code> 查看详情。</p>",
      `racecalendar-incident-${incidentKey}-${Math.floor(Date.now() / (6 * 60 * 60 * 1000))}`,
    )
    logServerWarn("notifications.schedule_incident_email_sent", { dedupeHours: 6 })
  } catch (error) {
    logServerError("notifications.schedule_incident_alert_failed", {}, error)
  }
}

export async function sendDatabaseAvailabilityAlert() {
  try {
    const day = shanghaiDate()
    await sendEmail(
      "赛道时刻：数据库健康检查失败",
      "定时健康检查无法读取赛历数据库。请检查 Vercel Runtime Logs 中的 notifications.daily_health_check_failed。",
      "<p>定时健康检查无法读取赛历数据库。</p><p>请在 Vercel Runtime Logs 中搜索 <code>notifications.daily_health_check_failed</code> 查看详情。</p>",
      `racecalendar-database-alert-${day}`,
    )
    logServerWarn("notifications.database_alert_email_sent", { day })
  } catch (error) {
    logServerError("notifications.database_alert_email_failed", {}, error)
  }
}

export async function sendMonthlyHealthReport() {
  const today = shanghaiDate()
  if (today.slice(-2) !== "01") return { sent: false, reason: "not-report-day" }

  const range = previousMonthRange(today)
  const sql = await getNotificationSql()
  const claimed = await sql`
    INSERT INTO notification_monthly_reports (month, sent_at)
    VALUES (${range.key}, NOW())
    ON CONFLICT (month) DO NOTHING
    RETURNING month
  `
  if (!claimed.length) return { sent: false, reason: "already-sent" }

  try {
    const rows = await sql`
      SELECT series, COALESCE(SUM(check_count), 0)::int AS checks,
        COALESCE(SUM(failure_count), 0)::int AS failures
      FROM notification_health_daily
      WHERE day >= ${range.start}::date AND day < ${range.end}::date
      GROUP BY series
    `
    const stats = (["F1", "FE", "WRC"] as const).map(series => {
      const row = rows.find(item => item.series === series)
      return { series, checks: Number(row?.checks ?? 0), failures: Number(row?.failures ?? 0) }
    })
    const monthLabel = range.key.replace("-", " 年 ") + " 月"
    const lines = stats.map(item => `${item.series}: ${item.checks} 次赛历检查，${item.failures} 次不可用`).join("\n")
    const htmlRows = stats.map(item => `<li><strong>${item.series}</strong>：${item.checks} 次赛历检查，${item.failures} 次不可用</li>`).join("")

    await sendEmail(
      `赛道时刻月报 · ${monthLabel}`,
      `${monthLabel}赛历服务摘要\n${lines}\n\n统计来自用户访问时的赛历可用性采样，不代表持续探测或完整站点运行时间。`,
      `<p>${monthLabel}赛历服务摘要</p><ul>${htmlRows}</ul><p>统计来自用户访问时的赛历可用性采样，不代表持续探测或完整站点运行时间。</p>`,
      `racecalendar-monthly-report-${range.key}`,
    )
    logServerInfo("notifications.monthly_report_sent", { month: range.key })
    return { sent: true, month: range.key }
  } catch (error) {
    await sql`DELETE FROM notification_monthly_reports WHERE month = ${range.key}`.catch(() => [])
    throw error
  }
}
