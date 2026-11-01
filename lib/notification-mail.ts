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
    await sql`
      CREATE TABLE IF NOT EXISTS notification_client_error_windows (
        window_start TIMESTAMPTZ NOT NULL,
        kind TEXT NOT NULL,
        report_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (window_start, kind)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS notification_email_log (
        id BIGSERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

async function sendEmail(subject: string, text: string, html: string, idempotencyKey: string, category: string) {
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
  try {
    const sql = await getNotificationSql()
    await sql`INSERT INTO notification_email_log (category) VALUES (${category})`
  } catch (error) {
    logServerWarn("notifications.email_log_failed", { category }, error)
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
      "schedule-incident",
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
      "赛道时刻：数据库初始化失败",
      "赛历请求期间无法初始化数据库。请检查 Vercel Runtime Logs 中的 api.schedule.database_init_failed。",
      "<p>赛历请求期间无法初始化数据库。</p><p>请在 Vercel Runtime Logs 中搜索 <code>api.schedule.database_init_failed</code> 查看详情。</p>",
      `racecalendar-database-alert-${day}`,
      "database-incident",
    )
    logServerWarn("notifications.database_alert_email_sent", { day })
  } catch (error) {
    logServerError("notifications.database_alert_email_failed", {}, error)
  }
}

export async function recordClientScheduleFailure() {
  try {
    const sql = await getNotificationSql()
    const windowStart = new Date(Math.floor(Date.now() / 600_000) * 600_000).toISOString()
    const rows = await sql`
      INSERT INTO notification_client_error_windows (window_start, kind, report_count)
      VALUES (${windowStart}, 'schedule-load-failed', 1)
      ON CONFLICT (window_start, kind) DO UPDATE SET
        report_count = notification_client_error_windows.report_count + 1
      RETURNING report_count
    `
    await sql`DELETE FROM notification_client_error_windows WHERE window_start < NOW() - INTERVAL '7 days'`
    const reportCount = Number(rows[0]?.report_count ?? 0)
    if (reportCount < 5) return

    const incidentKey = "client-schedule-load-failures"
    const claimed = await sql`
      INSERT INTO notification_incidents (incident_key, last_sent_at)
      VALUES (${incidentKey}, NOW())
      ON CONFLICT (incident_key) DO UPDATE SET last_sent_at = NOW()
      WHERE notification_incidents.last_sent_at < NOW() - INTERVAL '6 hours'
      RETURNING incident_key
    `
    if (!claimed.length) return

    await sendEmail(
      "赛道时刻：近期出现赛历加载失败",
      "最近 10 分钟内至少收到 5 次浏览器赛历加载失败报告。若这不是你预期的维护，请检查 api.schedule 与客户端网络错误日志。",
      "<p>最近 10 分钟内至少收到 5 次浏览器赛历加载失败报告。</p><p>若这不是你预期的维护，请检查 Vercel Runtime Logs 中的 <code>api.schedule</code> 相关记录。</p>",
      `racecalendar-client-schedule-alert-${Math.floor(Date.now() / (6 * 60 * 60 * 1000))}`,
      "client-incident",
    )
    logServerWarn("notifications.client_schedule_incident_email_sent", { reportCount, dedupeHours: 6 })
  } catch (error) {
    logServerError("notifications.client_schedule_report_failed", {}, error)
  }
}

export async function sendMonthlyHealthReport() {
  const today = shanghaiDate()
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
      "monthly-report",
    )
    logServerInfo("notifications.monthly_report_sent", { month: range.key })
    return { sent: true, month: range.key }
  } catch (error) {
    await sql`DELETE FROM notification_monthly_reports WHERE month = ${range.key}`.catch(() => [])
    throw error
  }
}

export async function sendAdminTestEmail() {
  const sql = await getNotificationSql()
  const claimed = await sql`
    INSERT INTO notification_incidents (incident_key, last_sent_at)
    VALUES ('admin-email-test', NOW())
    ON CONFLICT (incident_key) DO UPDATE SET last_sent_at = NOW()
    WHERE notification_incidents.last_sent_at < NOW() - INTERVAL '1 minute'
    RETURNING incident_key
  `
  if (!claimed.length) throw new Error("测试邮件发送过于频繁，请一分钟后再试")

  try {
    await sendEmail(
      "赛道时刻：邮件配置测试成功",
      "这是一封由后台手动触发的测试邮件。Resend 已接受发送请求。",
      "<p>这是一封由后台手动触发的测试邮件。</p><p>Resend 已接受发送请求。</p>",
      `racecalendar-admin-email-test-${Math.floor(Date.now() / 60_000)}`,
      "admin-test",
    )
    logServerInfo("notifications.admin_test_email_accepted")
  } catch (error) {
    await sql`DELETE FROM notification_incidents WHERE incident_key = 'admin-email-test'`.catch(() => [])
    throw error
  }
}

export async function getNotificationMonitorSnapshot() {
  const sql = await getNotificationSql()
  const [health, incidents, monthly, clientErrors, emails] = await Promise.all([
    sql`SELECT day, series, check_count, failure_count FROM notification_health_daily WHERE day >= CURRENT_DATE - 30 ORDER BY day DESC, series ASC LIMIT 120`,
    sql`SELECT incident_key, last_sent_at FROM notification_incidents WHERE incident_key <> 'admin-email-test' ORDER BY last_sent_at DESC LIMIT 20`,
    sql`SELECT month, sent_at FROM notification_monthly_reports ORDER BY month DESC LIMIT 12`,
    sql`SELECT kind, SUM(report_count)::int AS report_count, MAX(window_start) AS latest_at FROM notification_client_error_windows WHERE window_start >= NOW() - INTERVAL '24 hours' GROUP BY kind ORDER BY latest_at DESC`,
    sql`SELECT category, accepted_at FROM notification_email_log ORDER BY accepted_at DESC LIMIT 20`,
  ])
  return {
    config: {
      apiKey: Boolean(process.env.RESEND_API_KEY),
      from: Boolean(process.env.RESEND_FROM_EMAIL),
      recipient: Boolean(process.env.ALERT_MAIL_TO),
    },
    health,
    incidents,
    monthly,
    clientErrors,
    emails,
    fetchedAt: new Date().toISOString(),
  }
}
