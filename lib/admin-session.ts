import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export const ADMIN_COOKIE = "admin_auth"
export const SESSION_SECONDS = 3600

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`racecalendar-admin-v1:${payload}`).digest("base64url")
}

export function passwordMatches(value: unknown, secret: string): boolean {
  if (typeof value !== "string") return false
  const actual = Buffer.from(value)
  const expected = Buffer.from(secret)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createAdminSession(secret: string, now = Date.now()): string {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(24).toString("base64url")}`
  return `${payload}.${sign(payload, secret)}`
}

export function verifyAdminSession(token: string | undefined, secret: string | undefined, now = Date.now()): boolean {
  if (!token || !secret || token.length > 256) return false
  const parts = token.split(".")
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[\w-]{32}$/.test(parts[1])) return false
  const expires = Number(parts[0])
  const seconds = Math.floor(now / 1000)
  if (expires <= seconds || expires > seconds + SESSION_SECONDS) return false
  const signature = Buffer.from(parts[2])
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret))
  return signature.length === expected.length && timingSafeEqual(signature, expected)
}

export function readAdminCookie(request: Request): string | undefined {
  return request.headers.get("cookie")?.split(";").map(part => part.trim())
    .find(part => part.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1)
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  return (!origin || origin === new URL(request.url).origin)
    && request.headers.get("sec-fetch-site") !== "cross-site"
}
