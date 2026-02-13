## Rate Limits

All API keys are subject to rate limiting. Limits vary by plan tier.

### Tiers

| Tier | Requests / minute | Burst | Pipeline calls / hour |
|------|-------------------|-------|-----------------------|
| **Free** | 60 | 10 | 20 |
| **Pro** | 600 | 50 | 200 |
| **Enterprise** | 6,000 | 500 | 2,000 |
| **Self-hosted** | Unlimited | -- | Unlimited |

### Response headers

Every response includes rate-limit headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | UTC epoch seconds when the window resets |
| `Retry-After` | Seconds to wait (only present on `429` responses) |

### Handling 429 responses

When you exceed the limit, the API returns:

```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "retryAfter": 12
}
```

Best practices:

1. **Respect `Retry-After`** -- wait the indicated number of seconds.
2. **Use exponential back-off** -- if retries continue to fail, double the wait each attempt.
3. **Batch where possible** -- use bulk endpoints to reduce call count.
4. **Cache responses** -- caller profiles and specs change infrequently.
