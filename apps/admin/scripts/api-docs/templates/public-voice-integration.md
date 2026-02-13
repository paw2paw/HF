## Voice Integration

HF integrates with popular voice platforms to analyse live conversations
in real time.

### VAPI

HF ships with a first-class VAPI integration. Point your VAPI assistant's
server URL at your HF instance:

```
Server URL: https://api.hf.app/api/v1/webhooks/vapi
```

Configure the following in your VAPI dashboard:

| Setting | Value |
|---------|-------|
| Server URL | `https://api.hf.app/api/v1/webhooks/vapi` |
| Auth Header | `Authorization: Bearer hf_live_xxx` |
| Events | `call.completed`, `call.transcript` |

HF will automatically:

1. Receive the transcript when the call ends
2. Match or create the caller by phone number
3. Run the full analysis pipeline
4. Update the caller's personality profile and memories

### Twilio

For Twilio-based voice systems, use the generic webhook endpoint:

```bash
curl -X POST https://api.hf.app/api/v1/webhooks/ingest \
  -H "Authorization: Bearer $HF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "twilio",
    "callSid": "CA1234567890",
    "transcript": "...",
    "callerPhone": "+15551234567",
    "duration": 180
  }'
```

### Generic webhook

Any voice platform can push transcripts through the generic ingest endpoint:

```bash
curl -X POST https://api.hf.app/api/v1/webhooks/ingest \
  -H "Authorization: Bearer $HF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "custom",
    "externalCallId": "your-call-id",
    "transcript": "Full conversation transcript...",
    "callerExternalId": "your-user-id",
    "metadata": {
      "duration": 240,
      "language": "en"
    }
  }'
```

### Transcript format

HF accepts transcripts in several formats:

| Format | Content-Type | Description |
|--------|-------------|-------------|
| Plain text | `text/plain` | Raw transcript string |
| JSON (HF) | `application/json` | Structured with speaker labels |
| JSON (VAPI) | `application/json` | Native VAPI transcript format |

Structured format with speaker labels:

```json
{
  "turns": [
    { "speaker": "agent", "text": "Hello, how can I help?" },
    { "speaker": "caller", "text": "I'd like to learn about..." }
  ]
}
```
