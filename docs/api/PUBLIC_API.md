# Kironyx Public API

Read-only programmatic access to your workspace's competitor intelligence. Available on **Strategist** and **Command** plans.

## Quickstart

1. **Mint a key.** Sign in as the workspace owner → Settings → Workspace tab → API keys section. Click "Create" and label the key (e.g. `Production BI sync`). The plaintext is shown **once** — copy it immediately.
2. **Send requests** with the `X-API-Key` header:

```bash
curl -H "X-API-Key: rsk_live_..." \
  https://api.kironyx.com/v1/competitors
```

The base URL is your API Gateway URL. For local testing it's whatever `NEXT_PUBLIC_API_URL` points at.

## Authentication

Every `/v1/*` request requires `X-API-Key`. Keys are workspace-scoped: a key created in workspace A cannot read workspace B's data. Revoking a key (Settings → API keys → trash icon) immediately invalidates it.

### Scopes

Keys are minted with one of two scopes:

- **`read`** (default) — can hit all `GET /v1/*` endpoints.
- **`write`** — superset of read; additionally unlocks the write endpoints (`POST /v1/competitors`, `PATCH /v1/competitors/{id}/snooze`, `PATCH /v1/recommendations/{id}`).

Owners pick the scope at creation time in **Settings → Workspace → API keys**. Existing read-only keys keep working unchanged after this update — they default to `read` if they don't have an explicit scope on the row.

| Status | Code | Meaning |
|---|---|---|
| 401 | `MISSING_API_KEY` | `X-API-Key` header absent |
| 401 | `INVALID_API_KEY` | Key is wrong, revoked, or disabled |
| 403 | `PLAN_REQUIRED` | Workspace owner is on Scout (or downgraded after key creation) |
| 403 | `WRITE_SCOPE_REQUIRED` | Key is read-only but the endpoint requires `write` scope |
| 429 | `RATE_LIMITED` | Per-key minute throttle exceeded |

## Rate limits

- **60 requests / minute** per API key (default).
- The window resets opportunistically based on `Date.now()` deltas, not wall-clock minutes.
- WAF + API Gateway IP-based limits also apply (per the Phase 9a hardening) — at typical usage these never trigger before the per-key limit.

If you need higher throughput, contact support.

## Response envelope

All endpoints return:

```json
{
  "data": [ /* array of resources */ ],
  "meta": {
    "cursor": "eyJQ...",   // omitted on the last page
    "hasMore": true
  }
}
```

Pagination is cursor-based. To page forward, pass `?cursor=<the previous response's meta.cursor>`. Default `limit` is 50; override with `?limit=N` (max 100).

## Endpoints

### `GET /v1/competitors`

Lists the workspace's competitors with current enrichment fields (threat level, momentum, derived tags).

```bash
curl -H "X-API-Key: $KEY" "$BASE/v1/competitors?limit=20"
```

Response item shape:

```json
{
  "id": "01H8...",
  "name": "Acme Corp",
  "url": "https://acme.example",
  "status": "active",
  "threatLevel": "high",
  "momentum": "rising",
  "momentumChangePercent": 42,
  "derivedTags": ["growth-stage", "hiring-aggressively"],
  "createdAt": "2026-04-01T12:00:00.000Z",
  "updatedAt": "2026-05-06T09:00:00.000Z"
}
```

### `GET /v1/changes`

Lists recent change events newest-first.

Query params:

| Param | Type | Description |
|---|---|---|
| `since` | ISO timestamp | Drop changes older than this |
| `minSignificance` | integer 0–10 | Drop low-significance noise |
| `limit` | integer 1–100 | Page size (default 50) |
| `cursor` | string | Pagination cursor from previous `meta.cursor` |

```bash
curl -H "X-API-Key: $KEY" \
  "$BASE/v1/changes?minSignificance=5&since=2026-05-01T00:00:00Z"
```

Response item shape:

```json
{
  "id": "01H8...",
  "competitorId": "01H7...",
  "competitorName": "Acme Corp",
  "pageUrl": "https://acme.example/pricing",
  "significance": 8,
  "aiAnalysis": {
    "changeType": "pricing",
    "summary": "Acme raised Pro tier from $49 to $69",
    "significanceScore": 8,
    "strategicImplication": "...",
    "recommendedAction": "..."
  },
  "detectedAt": "2026-05-05T14:23:00.000Z",
  "citations": [ /* source URLs + titles */ ]
}
```

### `GET /v1/recommendations`

Lists AI-generated strategic recommendations newest-first.

```bash
curl -H "X-API-Key: $KEY" "$BASE/v1/recommendations?limit=10"
```

Response item shape:

```json
{
  "id": "01H8...",
  "competitorId": "01H7...",
  "competitorName": "Acme Corp",
  "category": "pricing",
  "title": "Hold the line on the Pro tier",
  "body": "...",
  "effortLevel": "low",
  "timeHorizon": "this-week",
  "confidence": 0.78,
  "status": "open",
  "createdAt": "2026-05-06T08:00:00.000Z"
}
```

## Write endpoints (Strategist+ tier, write-scope keys only)

These endpoints **mutate workspace state**. They require an API key minted with `write` scope (Settings → Workspace → API keys → "Read + write"). A `read` key calling any of these returns **403 `WRITE_SCOPE_REQUIRED`**.

Every write call emits an audit event in your workspace's activity log (Settings → Workspace tab → Activity log) with the source IP and user-agent of the caller.

### `POST /v1/competitors`

Create a competitor. Same validation, plan-limit, sanctions, and AI-input-classifier checks as the dashboard. Counts against the workspace owner's daily research-quota the same as a manual create.

Request body:

```json
{
  "name": "Acme Corp",
  "url": "https://acme.example",
  "pagesToTrack": ["pricing", "features"]
}
```

Where `pagesToTrack` is an array of 1–5 page types (`pricing`, `features`, `homepage`, `blog`, `careers`).

```bash
curl -X POST -H "X-API-Key: $WRITE_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Acme","url":"https://acme.example","pagesToTrack":["pricing"]}' \
  "$BASE/v1/competitors"
```

Response (`201`):

```json
{
  "data": {
    "id": "01H8...",
    "name": "Acme",
    "url": "https://acme.example",
    "pagesToTrack": ["pricing"],
    "status": "active",
    "createdAt": "2026-05-07T12:00:00.000Z"
  }
}
```

Error codes specific to this endpoint:

| Status | Code | Meaning |
|---|---|---|
| 403 | `PLAN_LIMIT` | Workspace at `maxCompetitors` for its plan tier |
| 403 | `SANCTIONS_REJECTED` | URL hits the OFAC SDN denylist |
| 403 | `CLASSIFIER_REJECTED` | Haiku classifier flags the target as a person / non-business |
| 429 | `RATE_LIMIT_EXCEEDED` | Tier daily-research-quota exhausted |

### `PATCH /v1/competitors/{id}/snooze`

Set or clear a competitor's `snoozedUntil`. While snoozed, recurring research skips the competitor and its changes are filtered out of the weekly digest.

Request body:

```json
{ "snoozedUntil": "2026-06-07T00:00:00.000Z" }
```

Pass `"snoozedUntil": null` to un-snooze immediately.

```bash
curl -X PATCH -H "X-API-Key: $WRITE_KEY" -H "Content-Type: application/json" \
  -d '{"snoozedUntil":"2026-06-07T00:00:00.000Z"}' \
  "$BASE/v1/competitors/01H8.../snooze"
```

Response (`200`):

```json
{
  "data": {
    "id": "01H8...",
    "snoozedUntil": "2026-06-07T00:00:00.000Z",
    "snoozedAt": "2026-05-07T12:00:00.000Z"
  }
}
```

`snoozedUntil` must be a future ISO timestamp; otherwise returns 400 `INVALID_SNOOZE`.

### `PATCH /v1/recommendations/{id}`

Update a recommendation's status. Useful for marking a recommendation acted-on from a Slack thread or CRM workflow.

Request body:

```json
{ "status": "acted-on" }
```

Where `status` is one of `open` / `dismissed` / `acted-on`.

```bash
curl -X PATCH -H "X-API-Key: $WRITE_KEY" -H "Content-Type: application/json" \
  -d '{"status":"acted-on"}' \
  "$BASE/v1/recommendations/01H8..."
```

Response (`200`):

```json
{ "data": { "id": "01H8...", "status": "acted-on" } }
```

The status `acted-on` is logged for the prompt-quality framework (Phase 8) — your team's outcomes feed forward into recommendation tuning.

## Versioning

`/v1` is the stable read API (Phase 11) plus the three write endpoints above (Phase 13). Breaking changes — field renames, removed fields, semantic shifts — go to `/v2` with `/v1` kept alive for at least 6 months after a successor ships.

Additive changes (new optional fields, new endpoints) land in `/v1` without warning. Treat your client code as forward-compatible.

## Security notes

- Plaintext keys are returned exactly **once** at creation. Subsequent reads return only a 4-character hint (`rsk_live_…4f8c`).
- Keys are stored as `sha256(plaintext)` at rest; the database never holds plaintext.
- The audit log (Settings → Workspace tab → Activity log, owner-only) records every key creation and revocation with actor email + IP.
- Treat keys like passwords. If a key leaks: revoke it immediately, then create a new one.

## Out of scope (future)

- DELETE endpoints (delete competitor, delete recommendation)
- Per-key custom rate limits
- Per-endpoint scopes (today: `read` and `write` are the only two scopes; finer granularity like "read + write competitors but not recommendations" is roadmap)
- Webhooks for live events (today's webhook integration is one-way push from Kironyx; v1 has no subscribe-to-events flow)
- Bulk endpoints (`POST /v1/competitors/bulk-import` mirroring the dashboard's CSV import)
