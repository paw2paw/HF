## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `HF_SUPERADMIN_TOKEN` | Yes | -- | Bearer token for admin endpoints |
| `OPENAI_API_KEY` | Yes | -- | OpenAI API key for LLM calls |
| `NEXTAUTH_SECRET` | Yes | -- | NextAuth session encryption key |
| `NEXTAUTH_URL` | Yes | -- | Canonical URL of the app |
| `HF_KB_PATH` | No | `./kb` | Path to knowledge base files |
| `HF_LOG_LEVEL` | No | `info` | Log level: debug, info, warn, error |
| `HF_INTERNAL_SECRET` | No | -- | Secret for `x-internal-secret` header |
| `ANTHROPIC_API_KEY` | No | -- | Anthropic API key (Claude models) |
| `HF_RATE_LIMIT_RPM` | No | `600` | Rate limit: requests per minute |
| `HF_PIPELINE_TIMEOUT` | No | `30000` | Pipeline execution timeout (ms) |
| `HF_WEBHOOK_SECRET` | No | -- | HMAC secret for outbound webhook signatures |
| `HF_CORS_ORIGINS` | No | `*` | Comma-separated allowed CORS origins |
| `REDIS_URL` | No | -- | Redis URL for caching and rate limiting |
