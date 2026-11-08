const CHECK_TIMEOUT_MS = 12_000
const STALE_AFTER_MS = 75 * 60 * 1000
const HISTORY_LIMIT = 48
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const NTFY_RETRY_LIMIT = 3
const APP_ORIGIN = "https://race.huosai.ccwu.cc"
const CALENDAR_SAMPLE_START = "2027-01-01T12:00:00Z"

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0
}

function isNumber(value) {
  return (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value))
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value))
}

function cleanMessage(value) {
  return typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 180) : ""
}

function result(status, message) {
  return { status, message }
}

function validateF1Standings(payload, type) {
  const collection = type === "drivers" ? payload.drivers : payload.constructors
  if (!Array.isArray(collection)) return result("down", `返回数据缺少 ${type} 数组`)
  if (collection.length === 0) return result("degraded", "接口结构正常，但当前赛季尚无积分行")

  const validRows = collection.every((row) => {
    if (!isRecord(row) || !isNumber(row.position) || !isNumber(row.points) || !isNumber(row.wins)) return false
    if (type === "drivers") {
      return isRecord(row.Driver)
        && (hasText(row.Driver.driverId) || hasText(row.Driver.code))
        && hasText(row.Driver.givenName)
        && hasText(row.Driver.familyName)
        && Array.isArray(row.Constructors)
        && row.Constructors.every((team) => isRecord(team) && hasText(team.name))
    }
    return isRecord(row.Constructor)
      && hasText(row.Constructor.constructorId)
      && hasText(row.Constructor.name)
  })

  if (!validRows) return result("down", "积分行存在缺失姓名、名次或积分的记录")
  const expectedMinimum = type === "drivers" ? 10 : 5
  if (collection.length < expectedMinimum) return result("degraded", `仅返回 ${collection.length} 条有效记录，少于常见赛季规模`)
  return result("up", `${collection.length} 条积分记录通过字段校验`)
}

function validateWrcStandings(payload, expectedYear, now = new Date()) {
  if (!isRecord(payload.season) || !isNumber(payload.season.year)
    || !Array.isArray(payload.seasons) || payload.seasons.length === 0
    || !isRecord(payload.championship) || !isNumber(payload.championship.championshipId)
    || !hasText(payload.championship.name) || !Array.isArray(payload.championships)
    || !Array.isArray(payload.standings)) {
    return result("down", "缺少赛季、锦标赛或积分榜结构")
  }

  const year = Number(payload.season.year)
  if (expectedYear !== null && year !== expectedYear) return result("down", `请求 ${expectedYear} 赛季，但接口返回 ${year} 赛季`)
  if (payload.standings.length === 0) {
    if (expectedYear === null && year > now.getUTCFullYear()) {
      return result("up", `${year} 赛季目录与分组正常，积分尚未开始发布`)
    }
    return result("degraded", `${year} 赛季结构正常，但当前没有积分记录`)
  }

  const validRows = payload.standings.every((row) => isRecord(row)
    && isNumber(row.id)
    && isNumber(row.position)
    && isNumber(row.points)
    && hasText(row.name)
    && Array.isArray(row.rounds))
  if (!validRows) return result("down", "积分榜记录存在缺失姓名、名次、积分或分站数据的条目")
  if (payload.standings.length < 5) return result("degraded", `仅返回 ${payload.standings.length} 条有效积分记录`)
  return result("up", `${year} 赛季 ${payload.standings.length} 条积分记录通过字段校验`)
}

function validateFeStandings(payload) {
  if (!Array.isArray(payload.drivers)) return result("down", "返回数据缺少车手数组")
  if (payload.drivers.length === 0) return result("degraded", "接口结构正常，但尚无车手积分记录")

  const validRows = payload.drivers.every((driver) => isRecord(driver)
    && hasText(driver.code)
    && hasText(driver.name)
    && hasText(driver.team)
    && isNumber(driver.position)
    && isNumber(driver.points))
  if (!validRows) return result("down", "车手记录存在缺失姓名、车队、名次或积分的条目")
  if (payload.drivers.length < 10) return result("degraded", `仅返回 ${payload.drivers.length} 条有效车手记录`)
  return result("up", `${payload.drivers.length} 条车手积分记录通过字段校验`)
}

function validateF1Results(payload) {
  if (!Array.isArray(payload.races)) return result("down", "返回数据缺少比赛结果列表")
  if (payload.races.length === 0) return result("degraded", "赛季结果结构正常，但尚无已发布比赛结果")

  let resultCount = 0
  for (const race of payload.races) {
    if (!isRecord(race) || !hasText(race.raceName) || !isNumber(race.round) || !isDate(race.date) || !Array.isArray(race.Results)) {
      return result("down", "比赛结果缺少赛事名称、轮次、日期或名次列表")
    }
    if (race.Results.length === 0) return result("down", `${race.raceName} 未返回任何名次记录`)
    const validRows = race.Results.every((row) => isRecord(row)
      && isNumber(row.position)
      && isNumber(row.points)
      && isRecord(row.Driver)
      && hasText(row.Driver.driverId)
      && hasText(row.Driver.givenName)
      && hasText(row.Driver.familyName)
      && isRecord(row.Constructor)
      && hasText(row.Constructor.name))
    if (!validRows) return result("down", `${race.raceName} 的名次记录字段不完整`)
    resultCount += race.Results.length
  }

  return result("up", `${payload.races.length} 场比赛、${resultCount} 条名次记录通过字段校验`)
}

function validateFeResults(payload, now = new Date()) {
  if (!Array.isArray(payload.races) || !isRecord(payload.results)) return result("down", "返回数据缺少 FE 赛历或赛果对象")
  if (payload.races.length === 0) return result("degraded", "赛季结果结构正常，但尚无赛历记录")

  const validRaces = payload.races.every((race) => isRecord(race)
    && hasText(race.id)
    && hasText(race.name)
    && isNumber(race.sequence)
    && isDate(race.date))
  if (!validRaces) return result("down", "FE 赛历记录存在缺少赛事名、轮次或日期的条目")

  const resultLists = Object.values(payload.results)
  if (!resultLists.every(Array.isArray)) return result("down", "FE 赛果字段不是有效列表")
  const rows = resultLists.flat()
  if (rows.some((row) => !isRecord(row)
    || !hasText(row.position)
    || !hasText(row.driver)
    || !hasText(row.driverCode)
    || !isNumber(row.points))) {
    return result("down", "FE 赛果记录存在缺少车手、名次或积分的条目")
  }

  if (rows.length === 0) {
    const pastRaces = payload.races.some((race) => Date.parse(`${race.date}T23:59:59Z`) < now.getTime())
    return pastRaces
      ? result("degraded", `${payload.races.length} 场赛历有效，但已过比赛日期且尚无赛果记录`)
      : result("up", `${payload.races.length} 场赛历有效，赛季尚未产生赛果`)
  }
  return result("up", `${payload.races.length} 场赛事、${rows.length} 条赛果记录通过字段校验`)
}

function validateWrcResults(payload, now = new Date()) {
  if (!Array.isArray(payload.rallies)) return result("down", "返回数据缺少 WRC 拉力赛结果列表")
  if (payload.rallies.length === 0) return result("down", "没有返回任何 WRC 拉力赛")

  for (const rally of payload.rallies) {
    if (!isRecord(rally) || !hasText(rally.id) || !hasText(rally.name)
      || !isNumber(rally.round) || !isDate(rally.dateStart)
      || typeof rally.resultsAvailable !== "boolean" || !Array.isArray(rally.results)) {
      return result("down", "WRC 赛事目录缺少赛事编号、轮次、日期或赛果字段")
    }
    if (rally.resultsAvailable !== (rally.results.length > 0)) return result("down", `${rally.name} 的赛果标记与实际列表不一致`)
    if (rally.results.some((row) => !isRecord(row) || !hasText(row.position) || !hasText(row.driver))) {
      return result("down", `${rally.name} 存在缺少车手或名次的赛果记录`)
    }
  }

  const fourDaysAgo = now.getTime() - 4 * 24 * 60 * 60 * 1000
  const completed = payload.rallies.filter((rally) => Date.parse(`${rally.dateStart}T23:59:59Z`) < fourDaysAgo)
  const missing = completed.filter((rally) => !rally.resultsAvailable)
  const available = payload.rallies.filter((rally) => rally.resultsAvailable)
  const rowCount = available.reduce((count, rally) => count + rally.results.length, 0)

  if (completed.length > 0 && available.length === 0) {
    return result("down", `${payload.rallies.length} 场赛历有效，但已结束赛事均无排名数据`)
  }
  if (missing.length > 0) {
    return result("degraded", `${available.length}/${payload.rallies.length} 场已有赛果；${missing.length} 场已结束超过 4 天仍缺排名`)
  }
  if (available.length === 0) return result("up", `${payload.rallies.length} 场赛历有效，暂无已结束赛事`)
  return result("up", `${available.length}/${payload.rallies.length} 场已有赛果，共 ${rowCount} 条名次记录`)
}

function buildTargets(year) {
  const calendarUrl = new URL(`${APP_ORIGIN}/api/calendar`)
  for (const [key, value] of Object.entries({
    id: "monitor-check-f1",
    series: "F1",
    round: "1",
    name: "Monitor check",
    circuit: "Test Circuit",
    locality: "Test City",
    country: "Test Country",
    utc: CALENDAR_SAMPLE_START,
  })) calendarUrl.searchParams.set(key, value)

  return [
    {
      id: "f1-standings",
      name: "F1 车手积分榜",
      url: `${APP_ORIGIN}/api/f1-standings?type=drivers&season=current`,
      validate: (payload) => validateF1Standings(payload, "drivers"),
    },
    {
      id: "f1-constructor-standings",
      name: "F1 车队积分榜",
      url: `${APP_ORIGIN}/api/f1-standings?type=constructors&season=current`,
      validate: (payload) => validateF1Standings(payload, "constructors"),
    },
    {
      id: "wrc-active-standings",
      name: `WRC ${year} 赛季积分榜`,
      url: `${APP_ORIGIN}/api/wrc-standings?season=${year}`,
      validate: (payload, now) => validateWrcStandings(payload, year, now),
    },
    {
      id: "wrc-standings",
      name: "WRC 最新赛季数据",
      url: `${APP_ORIGIN}/api/wrc-standings?season=current`,
      validate: (payload, now) => validateWrcStandings(payload, null, now),
    },
    {
      id: "fe-standings",
      name: "Formula E 车手积分榜",
      url: `${APP_ORIGIN}/api/fe-drivers`,
      validate: validateFeStandings,
    },
    {
      id: "f1-race-results",
      name: "F1 赛果",
      url: `${APP_ORIGIN}/api/results?series=F1&season=${year}`,
      validate: validateF1Results,
    },
    {
      id: "fe-race-results",
      name: "Formula E 赛果",
      url: `${APP_ORIGIN}/api/results?series=FE&season=${year}`,
      validate: (payload, now) => validateFeResults(payload, now),
    },
    {
      id: "wrc-race-results",
      name: "WRC 历史赛果",
      url: `${APP_ORIGIN}/api/results?series=WRC&season=${year}`,
      timeoutMs: 60_000,
      validate: (payload, now) => validateWrcResults(payload, now),
    },
    {
      id: "calendar-export",
      name: "赛事日历导出",
      responseType: "calendar",
      url: calendarUrl.toString(),
    },
  ]
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

async function responseNote(response) {
  try {
    const payload = await response.clone().json()
    return cleanMessage(payload?.note ?? payload?.message)
  } catch {
    return ""
  }
}

async function checkTarget(target, now) {
  const startedAt = Date.now()

  try {
    const response = await fetch(target.url, {
      method: "GET",
      headers: { Accept: target.responseType === "calendar" ? "text/calendar" : "application/json" },
      signal: AbortSignal.timeout(target.timeoutMs ?? CHECK_TIMEOUT_MS),
    })
    const latencyMs = Date.now() - startedAt

    if (!response.ok) {
      const note = await responseNote(response)
      return {
        targetId: target.id,
        status: "down",
        checkedAtMs: Date.now(),
        latencyMs,
        httpStatus: response.status,
        message: cleanMessage(`接口返回 HTTP ${response.status}${note ? `：${note}` : ""}`),
      }
    }

    if (target.responseType === "calendar") {
      const contentType = response.headers.get("content-type") ?? ""
      const body = await response.text()
      const validCalendar = contentType.includes("text/calendar")
        && body.includes("BEGIN:VCALENDAR")
        && body.includes("BEGIN:VEVENT")
        && body.includes("SUMMARY:Monitor check - F1")
        && body.includes("DTSTART:20270101T120000Z")
      return {
        targetId: target.id,
        status: validCalendar ? "up" : "down",
        checkedAtMs: Date.now(),
        latencyMs,
        httpStatus: response.status,
        message: validCalendar ? "ICS 文件头、赛事名称与 UTC 开始时间有效" : "导出响应不是有效的赛事 ICS 文件",
      }
    }

    let payload
    try {
      payload = await response.json()
    } catch {
      return {
        targetId: target.id,
        status: "down",
        checkedAtMs: Date.now(),
        latencyMs,
        httpStatus: response.status,
        message: "接口响应不是有效 JSON",
      }
    }

    if (!isRecord(payload) || payload.ok !== true) {
      const note = cleanMessage(payload?.note ?? payload?.message)
      return {
        targetId: target.id,
        status: "down",
        checkedAtMs: Date.now(),
        latencyMs,
        httpStatus: response.status,
        message: cleanMessage(`接口返回失败状态${note ? `：${note}` : ""}`),
      }
    }

    const validation = target.validate ? target.validate(payload, now) : result("up", "响应有效")
    return {
      targetId: target.id,
      status: latencyMs >= 8_000 && validation.status === "up" ? "degraded" : validation.status,
      checkedAtMs: Date.now(),
      latencyMs,
      httpStatus: response.status,
      message: latencyMs >= 8_000 && validation.status === "up"
        ? `${validation.message}；接口响应较慢`
        : cleanMessage(validation.message),
    }
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    return {
      targetId: target.id,
      status: "down",
      checkedAtMs: Date.now(),
      latencyMs: Date.now() - startedAt,
      httpStatus: null,
      message: timedOut ? "请求超时" : "连接失败",
    }
  }
}

async function sendTransitionNotifications(env, checks) {
  if (!env.NTFY_TOPIC_URL) return

  const stateRows = await Promise.all(checks.map((check) =>
    env.DB.prepare("SELECT last_notified_status FROM api_monitor_notification_state WHERE target_id = ?")
      .bind(check.targetId)
      .first()
  ))

  const nextStates = []
  const messages = []

  checks.forEach((check, index) => {
    const lastNotifiedStatus = stateRows[index]?.last_notified_status ?? null
    const currentStatus = check.status === "up" ? "up" : "down"

    if (lastNotifiedStatus === null && currentStatus === "up") {
      nextStates.push({ targetId: check.targetId, status: currentStatus })
      return
    }

    if (lastNotifiedStatus === currentStatus) return

    const target = buildTargets(new Date(check.checkedAtMs).getUTCFullYear()).find((item) => item.id === check.targetId)
    const message = currentStatus === "down"
      ? `${target?.name ?? check.targetId} 检查异常：${check.message}`
      : `${target?.name ?? check.targetId} 已恢复正常：${check.message}`
    messages.push(message)
    nextStates.push({ targetId: check.targetId, status: currentStatus })
  })

  const transitionStates = nextStates.filter((next) =>
    stateRows[checks.findIndex((check) => check.targetId === next.targetId)]?.last_notified_status !== next.status
  )

  if (messages.length) {
    const hasFailure = checks.some((check) =>
      check.status === "down" && transitionStates.some((next) => next.targetId === check.targetId)
    )
    let delivered = false
    let lastFailure = "unknown"
    let attempts = 0

    for (let attempt = 1; attempt <= NTFY_RETRY_LIMIT; attempt += 1) {
      attempts = attempt
      try {
        const response = await fetch(env.NTFY_TOPIC_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Title": "赛道时刻 API 监控",
            "Priority": hasFailure ? "4" : "3",
            "Tags": hasFailure ? "warning" : "white_check_mark",
          },
          body: messages.join("\n"),
          signal: AbortSignal.timeout(25_000),
        })

        if (response.ok) {
          delivered = true
          if (attempt > 1) console.log(JSON.stringify({ event: "monitor.ntfy_retry_succeeded", attempt }))
          break
        }

        lastFailure = `HTTP ${response.status}`
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500
        if (!retryable) break
      } catch (error) {
        lastFailure = error instanceof Error ? error.name : "unknown"
      }

      if (attempt < NTFY_RETRY_LIMIT) await new Promise((resolve) => setTimeout(resolve, 300 * attempt))
    }

    if (!delivered) {
      console.warn(JSON.stringify({ event: "monitor.ntfy_delivery_failed", attempts, failure: lastFailure }))
      return
    }
  }

  if (nextStates.length) {
    await env.DB.batch(nextStates.map((state) => env.DB.prepare(`
      INSERT INTO api_monitor_notification_state (target_id, last_notified_status, updated_at_ms)
      VALUES (?, ?, ?)
      ON CONFLICT(target_id) DO UPDATE SET
        last_notified_status = excluded.last_notified_status,
        updated_at_ms = excluded.updated_at_ms
    `).bind(state.targetId, state.status, Date.now())))
  }
}

async function runChecks(env) {
  const now = new Date()
  const checks = await Promise.all(buildTargets(now.getUTCFullYear()).map((target) => checkTarget(target, now)))
  const cutoff = Date.now() - RETENTION_MS

  try {
    const statements = checks.map((check) => env.DB.prepare(`
      INSERT INTO api_monitor_checks
        (target_id, checked_at_ms, status, latency_ms, http_status, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(check.targetId, check.checkedAtMs, check.status, check.latencyMs, check.httpStatus, check.message))

    statements.push(env.DB.prepare("DELETE FROM api_monitor_checks WHERE checked_at_ms < ?").bind(cutoff))
    await env.DB.batch(statements)
  } catch (error) {
    console.error(JSON.stringify({ event: "monitor.check_storage_failed", error: error instanceof Error ? error.name : "unknown" }))
    throw error
  }

  try {
    await sendTransitionNotifications(env, checks)
  } catch (error) {
    console.warn(JSON.stringify({ event: "monitor.notification_state_failed", error: error instanceof Error ? error.name : "unknown" }))
  }

  console.log(JSON.stringify({
    event: "monitor.checks_finished",
    checks: checks.map(({ targetId, status, latencyMs, httpStatus, message }) => ({ targetId, status, latencyMs, httpStatus, message })),
  }))
}

async function getStatus(env) {
  try {
    const targets = buildTargets(new Date().getUTCFullYear())
    const histories = await Promise.all(targets.map((target) =>
      env.DB.prepare(`
        SELECT checked_at_ms, status, latency_ms, http_status, message
        FROM api_monitor_checks
        WHERE target_id = ?
        ORDER BY checked_at_ms DESC
        LIMIT ?
      `).bind(target.id, HISTORY_LIMIT).all()
    ))

    const monitors = targets.map((target, index) => {
      const rows = histories[index].results ?? []
      const latest = rows[0]
      const stale = latest && Date.now() - latest.checked_at_ms > STALE_AFTER_MS
      return {
        id: target.id,
        name: target.name,
        status: latest ? stale ? "down" : latest.status : "unknown",
        checkedAt: latest ? new Date(latest.checked_at_ms).toISOString() : null,
        latencyMs: latest?.latency_ms ?? null,
        httpStatus: latest?.http_status ?? null,
        message: stale ? "定时检查已超过 75 分钟未完成" : latest?.message ?? "等待首次自动检查",
        history: rows.reverse().map((row) => ({
          status: row.status,
          checkedAt: new Date(row.checked_at_ms).toISOString(),
          latencyMs: row.latency_ms,
          httpStatus: row.http_status,
          message: row.message,
        })),
      }
    })

    const knownStatuses = monitors.map((monitor) => monitor.status).filter((status) => status !== "unknown")
    const overall = knownStatuses.length === 0
      ? "unknown"
      : monitors.every((monitor) => monitor.status === "down")
        ? "down"
        : monitors.some((monitor) => monitor.status !== "up")
          ? "degraded"
          : "up"

    return json({
      ok: true,
      overall,
      intervalMinutes: 30,
      historyHours: 24,
      retentionDays: 30,
      checkedAt: monitors.map((monitor) => monitor.checkedAt).filter(Boolean).sort().at(-1) ?? null,
      monitors,
    })
  } catch (error) {
    console.error(JSON.stringify({ event: "monitor.status_read_failed", error: error instanceof Error ? error.name : "unknown" }))
    return json({ ok: false, message: "监控数据暂时无法读取" }, 503)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
    if (request.method !== "GET" || url.pathname !== "/api/status") {
      return json({ ok: false, message: "Not found" }, 404)
    }

    return getStatus(env)
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runChecks(env))
  },
}
