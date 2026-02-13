## Common Patterns

### Response envelope

All responses use a consistent JSON envelope:

```json
{
  "ok": true,
  "data": { ... },
  "message": "Optional human-readable message"
}
```

Error responses:

```json
{
  "ok": false,
  "error": "Short error description",
  "details": "Extended information (development mode only)"
}
```

### Pagination

List endpoints support cursor-based pagination:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Items per page (max 500) |
| `offset` | number | 0 | Number of items to skip |

Response includes totals:

```json
{
  "ok": true,
  "callers": [ ... ],
  "total": 342,
  "limit": 100,
  "offset": 0
}
```

### Filtering

Many list endpoints accept query-string filters:

```bash
# Filter callers by domain
GET /api/v1/callers?domainId=abc-123&withCounts=true

# Filter calls by date range
GET /api/v1/calls?since=2026-01-01T00:00:00Z&until=2026-02-01T00:00:00Z
```

### Error codes

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad request -- check your parameters |
| `401` | Unauthorized -- missing or invalid API key |
| `403` | Forbidden -- insufficient scopes |
| `404` | Not found -- resource does not exist |
| `409` | Conflict -- resource already exists |
| `422` | Unprocessable -- validation failed |
| `429` | Rate limited -- slow down |
| `500` | Internal error -- contact support |

### Idempotency

POST endpoints that create resources accept an optional `Idempotency-Key`
header. If you send the same key within 24 hours, the API returns the
original response without creating a duplicate.

```bash
curl -X POST https://api.hf.app/api/v1/callers \
  -H "Authorization: Bearer $HF_API_KEY" \
  -H "Idempotency-Key: req-abc-123" \
  -H "Content-Type: application/json" \
  -d '{"name": "Alex"}'
```
