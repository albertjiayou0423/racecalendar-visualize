type LogValue = string | number | boolean | null | undefined
type LogFields = Record<string, LogValue>
type LogLevel = "info" | "warn" | "error"

const sensitiveField = /authorization|cookie|password|token|secret|api.?key|email|voter|payload|body|raw|url|coordinate|latitude|longitude/i

function cleanText(value: string): string {
  return value
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/\b(?:postgres(?:ql)?|mysql):\/\/[^\s"'<>]+/gi, "[database-url]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/((?:token|secret|password|api[_-]?key)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\bnvapi-[A-Za-z0-9_-]+/gi, "[redacted-api-key]")
    .slice(0, 240)
}

function cleanFields(fields: LogFields): LogFields {
  return Object.fromEntries(Object.entries(fields)
    .filter(([key, value]) => !sensitiveField.test(key) && value !== undefined)
    .map(([key, value]) => [key, typeof value === "string" ? cleanText(value) : value]))
}

/** Emit one searchable JSON record without request bodies, credentials, or raw URLs. */
export function logServerEvent(level: LogLevel, event: string, fields: LogFields = {}, error?: unknown) {
  const record: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...cleanFields(fields),
  }

  if (error !== undefined) {
    const message = error instanceof Error ? error.message : String(error)
    record.error = {
      name: error instanceof Error ? error.name : "NonError",
      message: cleanText(message),
    }
  }

  console[level](JSON.stringify(record))
}

export const logServerInfo = (event: string, fields?: LogFields) => logServerEvent("info", event, fields)
export const logServerWarn = (event: string, fields?: LogFields, error?: unknown) => logServerEvent("warn", event, fields, error)
export const logServerError = (event: string, fields?: LogFields, error?: unknown) => logServerEvent("error", event, fields, error)
