import * as Sentry from '@sentry/nextjs'
import { sentryDsn, sentryEnabled, sentryEnvironment } from './lib/sentry-config'

Sentry.init({
  dsn: sentryDsn,
  enabled: sentryEnabled,
  environment: sentryEnvironment,
  sampleRate: 1,
  maxBreadcrumbs: 30,
  beforeSend(event) {
    if (event.user) delete event.user
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers
      delete event.request.data
      delete event.request.query_string
    }
    return event
  },
})
