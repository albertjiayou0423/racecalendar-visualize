# Cloudflare API monitoring

The `/status` page combines a read-only Cloudflare Worker status feed with the public OpenStatus embed. The Worker runs from `workers.dev`, so monitoring does not require changing the project's DNS or proxy settings.

## Monitored functions

Every scheduled run checks 13 production functions with `GET` requests:

| Function | Endpoint | Response checks |
| --- | --- | --- |
| Home page | `/` | HTML document and site title |
| PWA manifest | `/manifest.webmanifest` | JSON, app name, launch path, display mode and icons |
| Offline service worker | `/sw.js` | JavaScript content type and install/fetch/cache handlers |
| F1 driver standings | `/api/f1-standings?type=drivers&season=current` | `ok`, rows, driver identity, team list, position, points, wins |
| F1 constructor standings | `/api/f1-standings?type=constructors&season=current` | `ok`, rows, constructor identity, position, points, wins |
| WRC requested-year standings | `/api/wrc-standings?season=<UTC current year>` | Returned year, championship metadata, driver identity, position, points, round data |
| WRC latest-season data | `/api/wrc-standings?season=current` | Season directory, championship metadata and standings; a valid future-season calendar with no points yet is healthy |
| Formula E driver standings | `/api/fe-drivers` | Driver identity, team, position and points |
| F1 results | `/api/results?series=F1&season=<UTC current year>` | Race identity/date/round and non-empty, complete result rows |
| Formula E results | `/api/results?series=FE&season=<UTC current year>` | Calendar entries and result row fields; no results is valid before the season begins |
| WRC historical results | `/api/results?series=WRC&season=<UTC current year>` | Rally directory and result rows; rallies more than four days past without results are degraded |
| Event weather | `/api/weather` with current UTC date and Sao Paulo coordinates | Timezone, source, five or more forecast days and required weather fields |
| Calendar export | `/api/calendar` with a synthetic valid event | `text/calendar`, VCALENDAR/VEVENT markers, expected event summary and UTC start |

The first three monitor IDs are retained from the original monitor so their existing history remains attached to the same feature. New checks validate payload contents, not only HTTP status or an `ok` flag. Empty data is treated according to season context: for example, an upcoming season with no points is valid, while completed events with missing results are not silently treated as healthy.

## Timeouts and statuses

- Standard API calls time out after 12 seconds. WRC results are allowed up to 60 seconds because the production route can be slower.
- A valid response taking at least 8 seconds is `degraded`.
- Invalid response shape, missing required fields, HTTP errors, or request failures are `down`.
- Missing WRC results for a rally more than four days past its start date is `degraded`; if every listed rally is past and none has results, it is `down`.
- If no check has been recorded for a monitor in 75 minutes, the read endpoint reports it as `down` with a stale-check message.

As observed on 2026-11-08, the production WRC results route returned HTTP 400 (`系列或赛季参数无效`) for the current year. The monitor therefore reports this independently as unavailable instead of hiding the failure behind healthy standings endpoints. This needs a separate application-route investigation.

The monitor intentionally does not call `/api/schedule`: that route can crawl upstream calendars, consume quota, initialize application database tables, and persist snapshots. Calendar export is stateless and uses only a synthetic sample.

## Cloudflare resources and notifications

- Worker: `racecalendar-api-monitor`
- D1 database: `racecalendar-api-monitor`
- Public read endpoint: `https://racecalendar-api-monitor.tangjiayou23.workers.dev/api/status`
- Scheduled interval: `*/30 * * * *` (every 30 minutes)
- Worker configuration source: `cloudflare/api-monitor/wrangler.toml`
- Observability logs and traces: enabled
- Secret binding: `NTFY_TOPIC_URL` is configured as a Worker secret.

The Worker sends ntfy messages only when a monitor changes between healthy and issue states. The first healthy check initializes state without a message. A failed ntfy delivery does not advance notification state, allowing a later scheduled run to retry. Delivery retries up to three times for network errors and temporary HTTP failures such as 5xx or 429, honoring `Retry-After` up to 60 seconds and otherwise using exponential backoff; permanent 4xx responses are not retried. Logs contain the HTTP status or error class, never the secret URL.

The first live notification attempt on 2026-11-08 received HTTP 522. The ntfy project has documented Cloudflare Worker egress timeouts to `ntfy.sh`; retries may succeed when a different shared egress path is used. If retries continue to fail, use a notification provider reachable from Workers or route through a separate service.

Notifications go to the configured ntfy topic and include the `/status` page. They cannot wake or directly start a Codex conversation; forward the alert into the project chat to have it investigated and fixed.

## Free-plan budgets and load

- `/api/status` is protected by an atomic daily D1 counter with a hard limit of 3,000 uncached Worker handler executions per UTC day. A response limit is cached until UTC midnight. Successful status responses use Workers Caching for 10 minutes and the browser for up to 1 minute; edge cache hits do not execute the handler or read D1, but Cloudflare still counts them as Worker requests for the account's daily request allowance.
- Scheduled checks are capped at 50 runs per UTC day. The configured cron produces 48 runs on a normal day, leaving two slots for a retry or schedule adjustment.
- Each scheduled run makes 13 application requests and at most three ntfy delivery attempts, for at most 16 external subrequests. This stays below the Free plan's default ceiling of 50 external subrequests per invocation.
- The status endpoint can read at most `13 monitors × 48 history rows × 3,000 uncached requests = 1,872,000` history rows per UTC day, plus the small daily-counter and scheduled-check queries. That leaves substantial room under D1's 5 million account-wide daily row-read allowance, though any other D1 workloads in the same Cloudflare account also use that allowance.
- The monitor's D1 counter caps status handler executions at 3,000 plus 50 scheduled runs per day. Cloudflare's separate 100,000 daily Worker request allowance is shared by the account and includes cache-served requests; unrelated Workers and arbitrary requests to unmonitored paths are outside this endpoint's counter. Keep an eye on the account-level usage dashboard because application code cannot prevent requests from counting before they reach this Worker.
- Worker Cache reduces repeat work at the edge. D1 history reads are combined into one batch call. The status page polls every 10 minutes only while visible, and the OpenStatus event-history iframe is created only when expanded and removed when collapsed.
- Cloudflare Free supplies a 10 ms CPU ceiling and allows up to 50 external subrequests per invocation. The Worker stays within those defaults without custom per-invocation limits; the API rejects custom CPU-limit overrides on Free. D1 usage also remains subject to the Free plan's account-wide daily read/write limits and 5 GB storage cap.

## Storage and privacy

D1 stores the endpoint ID, check time, status, latency, HTTP status, and a short sanitized diagnostic. Raw response bodies, cookies, credentials, and stack traces are not stored or exposed. Records older than 30 days are pruned during scheduled checks. The public status endpoint is read-only and returns at most 48 checks per monitor; reading it does not run checks or write to D1.

The status page shows 24-hour check coverage, uptime, per-check details, and gaps where a scheduled check is missing. The feed refreshes every 10 minutes while the tab is visible; its static rows are memoized, and unchanged responses do not trigger a React rerender.
