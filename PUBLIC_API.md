# RivalScan Public API

Read-only programmatic access to your workspace's competitor intelligence. Available on **Strategist** and **Command** plans.

## Quickstart

1. **Mint a key.** Sign in as the workspace owner → Settings → Workspace tab → API keys section. Click "Create" and label the key (e.g. `Production BI sync`). The plaintext is shown **once** — copy it immediately.
2. **Send requests** with the `X-API-Key` header:

```bash
curl -H "X-API-Key: rsk_live_..." \
  https://api.rivalscan.com/v1/competitors
```

The base URL is your API Gateway URL. For local testing it's whatever `NEXT_PUBLIC_API_URL` points at.

## Authentication

Every `/v1/*` request requires `X-API-Key`. Keys are workspace-scoped: a key created in workspace A cannot read workspace B's data. Revoking a key (Settings → API keys → trash icon) immediately invalidates it.

| Status | Code | Meaning |
|---|---|---|
| 401 | `MISSING_API_KEY` | `X-API-Key` header absent |
| 401 | `INVALID_API_KEY` | Key is wrong, revoked, or disabled |
| 403 | `PLAN_REQUIRED` | Workspace owner is on Scout (or downgraded after key creation) |
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

## Versioning

`/v1` is the stable read-only API. Breaking changes — field renames, removed fields, semantic shifts — go to `/v2` with `/v1` kept alive for at least 6 months after a successor ships.

Additive changes (new optional fields, new endpoints) land in `/v1` without warning. Treat your client code as forward-compatible.

## Security notes

- Plaintext keys are returned exactly **once** at creation. Subsequent reads return only a 4-character hint (`rsk_live_…4f8c`).
- Keys are stored as `sha256(plaintext)` at rest; the database never holds plaintext.
- The audit log (Settings → Workspace tab → Activity log, owner-only) records every key creation and revocation with actor email + IP.
- Treat keys like passwords. If a key leaks: revoke it immediately, then create a new one.

## Out of scope (future)

- Write endpoints (POST / PATCH / DELETE)
- Per-key custom rate limits
- Per-endpoint scopes
- Webhooks for live events (today's webhook integration is one-way push from RivalScan; v1 has no subscribe-to-events flow)
