## Security

### Transport

All API traffic must use **HTTPS** (TLS 1.2+). Plain HTTP requests are
rejected with a `301` redirect.

### API key best practices

| Practice | Details |
|----------|---------|
| **Never commit keys** | Use environment variables or a secrets manager |
| **Rotate regularly** | Rotate production keys every 90 days |
| **Least privilege** | Issue keys with only the scopes they need |
| **Separate environments** | Use `hf_test_` keys for development, `hf_live_` for production |
| **Monitor usage** | Review API key activity in the dashboard |

### PII handling

HF processes conversational data that may contain personally identifiable
information (PII). The platform provides several controls:

| Control | Description |
|---------|-------------|
| **Data retention** | Configure automatic deletion of transcripts after N days |
| **PII redaction** | Enable automatic redaction of phone numbers, emails, and names in stored transcripts |
| **Caller anonymisation** | Replace caller identifiers with opaque tokens |
| **Export & delete** | GDPR-compliant data export and right-to-erasure endpoints |

#### Requesting data deletion

```bash
# Delete all data for a specific caller
curl -X DELETE https://api.hf.app/api/v1/callers/<CALLER_ID> \
  -H "Authorization: Bearer $HF_API_KEY"
```

This permanently removes the caller profile, all associated calls,
memories, personality data, and analysis results.

### IP allowlisting

Enterprise plans support restricting API key usage to specific IP
addresses or CIDR ranges. Configure this in the Dashboard under
**Settings > API Keys > IP Restrictions**.

### Audit logging

All API requests are logged with:

- Timestamp, method, path
- API key ID (not the full key)
- Source IP address
- Response status code
- Request duration

Audit logs are retained for 90 days and available via the Dashboard
or the `/api/v1/admin/audit-logs` endpoint.
