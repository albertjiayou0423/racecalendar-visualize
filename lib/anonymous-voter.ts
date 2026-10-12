import { randomUUID } from "node:crypto"

export const ANONYMOUS_VOTER_COOKIE = "racecalendar_voter"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function resolveAnonymousVoterId(cookieHeader: string | null, createId = randomUUID) {
  const cookie = cookieHeader?.split(";").map(part => part.trim()).find(part => part.startsWith(`${ANONYMOUS_VOTER_COOKIE}=`))
  const value = cookie?.slice(ANONYMOUS_VOTER_COOKIE.length + 1)
  let candidate = value ?? ""
  try { candidate = decodeURIComponent(candidate) } catch { candidate = "" }
  if (UUID_PATTERN.test(candidate)) return { id: candidate.toLowerCase(), isNew: false }
  return { id: createId(), isNew: true }
}

export function anonymousVoterCookie(id: string, secure = process.env.NODE_ENV === "production") {
  return `${ANONYMOUS_VOTER_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`
}
