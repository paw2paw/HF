## Quick Start

Get up and running in three steps.

### 1. Get your API key

```bash
# From the HF Dashboard: Settings > API Keys > Create Key
export HF_API_KEY="hf_live_xxxxxxxxxxxxxxxxxxxx"
```

### 2. Create a caller and submit a call

```bash
# Create a new caller
curl -s -X POST https://api.hf.app/api/v1/callers \
  -H "Authorization: Bearer $HF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alex Johnson",
    "externalId": "user-42"
  }' | jq .

# Submit a call transcript for analysis
curl -s -X POST https://api.hf.app/api/v1/calls \
  -H "Authorization: Bearer $HF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "<CALLER_ID>",
    "transcript": "Hello, I would like to learn about...",
    "metadata": { "source": "api", "duration": 120 }
  }' | jq .
```

### 3. Run the pipeline and compose a prompt

```bash
# Trigger analysis pipeline on the call
curl -s -X POST https://api.hf.app/api/v1/pipeline/extract \
  -H "Authorization: Bearer $HF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "<CALL_ID>"
  }' | jq .

# Compose a personalised prompt for the caller
curl -s -X POST https://api.hf.app/api/v1/callers/<CALLER_ID>/compose-prompt \
  -H "Authorization: Bearer $HF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "playbookSlug": "companion"
  }' | jq .
```

The composed prompt includes personality context, memories, and
behaviour-specific instructions -- ready to pass to any LLM.

### What happens under the hood

```
Transcript ──> Pipeline EXTRACT ──> Personality scores
                                ──> Memories extracted
                                ──> Learning style detected
                                        │
                           Compose Prompt ◄──┘
                                │
                     Personalised system prompt
                      ready for your LLM call
```
