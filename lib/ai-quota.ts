export type AiQuotaResult = {
  allowed: boolean
  used: number
  remaining: number
  reason: "limit" | "unavailable" | null
}

type QuotaSql = (parts: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Record<string, unknown>[]>

/** Atomically consumes a slot before an upstream AI request so concurrent calls cannot pass the cap. */
export async function consumeAiQuotaSlot(sql: QuotaSql, date: string, limit: number): Promise<AiQuotaResult> {
  try {
    const rows = await sql`
      INSERT INTO ai_usage (date, count)
      VALUES (${date}, 1)
      ON CONFLICT (date) DO UPDATE
      SET count = ai_usage.count + 1
      WHERE ai_usage.count < ${limit}
      RETURNING count
    `
    if (!rows.length) return { allowed: false, used: limit, remaining: 0, reason: "limit" }

    const used = Number(rows[0].count)
    if (!Number.isInteger(used) || used < 1 || used > limit) {
      return { allowed: false, used: 0, remaining: 0, reason: "unavailable" }
    }
    return { allowed: true, used, remaining: Math.max(0, limit - used), reason: null }
  } catch {
    return { allowed: false, used: 0, remaining: 0, reason: "unavailable" }
  }
}
