export const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)
export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
export const sentryEnvironment = process.env.VERCEL_ENV ?? process.env.NODE_ENV
