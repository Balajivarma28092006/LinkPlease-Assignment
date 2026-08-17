# LinkPlease comment-to-DM service

An Express application that receives PseudoGram comment webhooks, matches them to rules, and reliably delivers DMs in the background.

## Project layout

```
src/app.js                  HTTP routes and request validation
src/database/               SQLite schema and setup
src/repositories/           Small, focused database access classes
src/services/               Business logic: inbox processing and DM delivery
src/workers/                Background polling worker
src/server.js               Dependency wiring and application startup
test/                       HTTP-level tests
```

The design has two durable queues in SQLite: an incoming-event inbox saves webhooks before responding, then a DM outbox tracks one job per `(rule, user)`. A restart cannot discard acknowledged work.

## Assignment coverage

| Requirement | Implementation |
| --- | --- |
| Rule creation and case-insensitive substring match | `POST /rules`, `EventService` |
| Fast webhook acknowledgement | `/webhook` only verifies and writes the inbox record |
| Duplicate event handling | unique `incoming_events.event_id` |
| One DM per user per rule | unique `dm_jobs(rule_id, recipient_user_id)` |
| API failures and rate limits | durable retries, backoff, `Retry-After`, local 10/60s guard |
| Webhook signatures | raw-body HMAC-SHA256 with timing-safe comparison |
| Live stats | derived from durable job states |
| Delivery reconciliation | poll accepted DMs; retry reported failures with a new idempotency key |
| Deleted comments | cancel unsent work; remember deletion before creation |

## Run locally

Install Node.js 20+ and dependencies, then configure your PseudoGram key:

```powershell
cd C:\Users\malla\Downloads\balaji_linkplease
Copy-Item .env.example .env
# Edit .env and add PSEUDOGRAM_API_KEY
npm start
```

The server starts at `http://localhost:3000`. Run `npm test` before deploying.

## Endpoints

`POST /rules`

```json
{ "keyword": "PRICE", "dm_message": "Here is the price list." }
```

`POST /webhook` accepts the assignment webhook shape and requires `X-PseudoGram-Signature: sha256=<hex>` when an API key is configured. `GET /stats` returns `sent`, `failed`, `queued`, and `duplicates_blocked`.

## Before you submit

1. Apply to PseudoGram, then request your API key using the two endpoints in the assignment.
2. Deploy with `npm start`. Attach a persistent disk and set `DATABASE_PATH` to it. Set `PSEUDOGRAM_API_KEY` as a secret.
3. Create a rule, call `/v1/simulate/start` with `https://your-domain/webhook`, then compare `/stats` with `/v1/simulate/{run_id}/truth` after the queue drains.
4. Push the repository publicly, including `FAILURES.md`.
5. Record the required three-minute Loom: one tradeoff and what you would change with another week.
6. Submit your GitHub URL, live URL, Loom URL, honest start date, and appropriate `parts_completed` value to `/v1/submit`. Keep the deployment live for seven days.
