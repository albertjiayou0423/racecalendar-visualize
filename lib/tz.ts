/**
 * 时区相关的工具函数。核心思路：所有场次统一以 UTC ISO 字符串存储，
 * 前端再借助 Intl 将其格式化为“当地时间”和“北京时间”。
 */

/** 计算某个 IANA 时区在给定时刻的偏移量（毫秒） */
export function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value
    return acc
  }, {})
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return asUTC - date.getTime()
}

/**
 * 将某个时区里的“墙上时间”（本地年月日时分）转换为对应的 UTC Date。
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const offset = getTimeZoneOffsetMs(timeZone, new Date(guess))
  return new Date(guess - offset)
}

/** F1 赛道 ID -> IANA 时区映射（2026 赛季） */
export const F1_CIRCUIT_TZ: Record<string, string> = {
  albert_park: "Australia/Melbourne",
  shanghai: "Asia/Shanghai",
  suzuka: "Asia/Tokyo",
  miami: "America/New_York",
  villeneuve: "America/Toronto",
  monaco: "Europe/Monaco",
  catalunya: "Europe/Madrid",
  red_bull_ring: "Europe/Vienna",
  silverstone: "Europe/London",
  spa: "Europe/Brussels",
  hungaroring: "Europe/Budapest",
  zandvoort: "Europe/Amsterdam",
  monza: "Europe/Rome",
  madring: "Europe/Madrid",
  baku: "Asia/Baku",
  marina_bay: "Asia/Singapore",
  americas: "America/Chicago",
  rodriguez: "America/Mexico_City",
  interlagos: "America/Sao_Paulo",
  vegas: "America/Los_Angeles",
  losail: "Asia/Qatar",
  yas_marina: "Asia/Dubai",
}

/** 英文国家名 -> 中文名 + 两位国家码 */
export const COUNTRY_MAP: Record<string, { zh: string; code: string }> = {
  Australia: { zh: "澳大利亚", code: "AU" },
  China: { zh: "中国", code: "CN" },
  Japan: { zh: "日本", code: "JP" },
  USA: { zh: "美国", code: "US" },
  "United States": { zh: "美国", code: "US" },
  Canada: { zh: "加拿大", code: "CA" },
  Monaco: { zh: "摩纳哥", code: "MC" },
  Spain: { zh: "西班牙", code: "ES" },
  Austria: { zh: "奥地利", code: "AT" },
  UK: { zh: "英国", code: "GB" },
  "United Kingdom": { zh: "英国", code: "GB" },
  Belgium: { zh: "比利时", code: "BE" },
  Hungary: { zh: "匈牙利", code: "HU" },
  Netherlands: { zh: "荷兰", code: "NL" },
  Italy: { zh: "意大利", code: "IT" },
  Azerbaijan: { zh: "阿塞拜疆", code: "AZ" },
  Singapore: { zh: "新加坡", code: "SG" },
  Mexico: { zh: "墨西哥", code: "MX" },
  Brazil: { zh: "巴西", code: "BR" },
  Qatar: { zh: "卡塔尔", code: "QA" },
  UAE: { zh: "阿联酋", code: "AE" },
  France: { zh: "法国", code: "FR" },
  Sweden: { zh: "瑞典", code: "SE" },
  Kenya: { zh: "肯尼亚", code: "KE" },
  Croatia: { zh: "克罗地亚", code: "HR" },
  Portugal: { zh: "葡萄牙", code: "PT" },
  Greece: { zh: "希腊", code: "GR" },
  Estonia: { zh: "爱沙尼亚", code: "EE" },
  Finland: { zh: "芬兰", code: "FI" },
  Paraguay: { zh: "巴拉圭", code: "PY" },
  Chile: { zh: "智利", code: "CL" },
  "Saudi Arabia": { zh: "沙特阿拉伯", code: "SA" },
  Germany: { zh: "德国", code: "DE" },
  "United Kingdom of Great Britain": { zh: "英国", code: "GB" },
}

/** 两位国家码 -> 中文名（用于 FE，其接口直接给出国家码） */
export const COUNTRY_CODE_MAP: Record<string, string> = {
  BR: "巴西",
  MX: "墨西哥",
  US: "美国",
  SA: "沙特阿拉伯",
  ES: "西班牙",
  DE: "德国",
  MC: "摩纳哥",
  CN: "中国",
  JP: "日本",
  GB: "英国",
}

/** 把国家码转换成对应的 Emoji 国旗 */
export function countryCodeToFlag(code?: string): string {
  if (!code || code.length !== 2) return ""
  const A = 0x1f1e6
  const base = "A".charCodeAt(0)
  return String.fromCodePoint(A + (code.charCodeAt(0) - base), A + (code.charCodeAt(1) - base))
}
