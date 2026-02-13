## Authentication

All API requests must include a valid API key in the `Authorization` header.

```
Authorization: Bearer hf_live_xxxxxxxxxxxxxxxxxxxx
```

### Obtaining an API key

1. Log in to the HF Dashboard.
2. Navigate to **Settings > API Keys**.
3. Click **Create Key**, select the required scopes, and copy the key.

API keys are shown **once** at creation time. Store them securely.

### Key types

| Prefix | Environment | Purpose |
|--------|------------|---------|
| `hf_live_` | Production | Live traffic, metered usage |
| `hf_test_` | Sandbox | Development and testing, no billing |

### Scopes

Each key is issued with one or more scopes that control access:

| Scope | Grants |
|-------|--------|
| `callers:read` | List and retrieve caller profiles |
| `callers:write` | Create, update, and delete callers |
| `calls:read` | Retrieve call transcripts and analysis results |
| `calls:write` | Submit new calls and trigger pipeline processing |
| `pipeline:execute` | Execute the analysis pipeline directly |
| `prompts:read` | Compose and retrieve prompts |
| `specs:read` | List and retrieve analysis specifications |
| `specs:write` | Create and modify specifications |
| `playbooks:read` | List and retrieve playbooks |
| `playbooks:write` | Create and modify playbooks |
| `webhooks:manage` | Register and manage webhook endpoints |
| `admin` | Full access (use with caution) |

### Webhook signature verification

Outbound webhook payloads include an `X-HF-Signature` header containing an
HMAC-SHA256 signature. Verify it against your webhook secret:

```bash
EXPECTED=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')
if [ "$EXPECTED" = "$RECEIVED_SIGNATURE" ]; then
  echo "Valid"
fi
```

### Error responses

Authentication failures return one of:

| Status | Meaning |
|--------|---------|
| `401 Unauthorized` | Missing or invalid API key |
| `403 Forbidden` | Valid key but insufficient scopes |
| `429 Too Many Requests` | Rate limit exceeded (see [Rate Limits](#rate-limits)) |
