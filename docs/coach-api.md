# Coach API

`POST /api/coach` is the boundary between the check-in UI and coaching generation.

## Request

```json
{
  "language": "he",
  "tone": "tony_coach",
  "emotionalState": "anxious",
  "escape": 7,
  "energy": 5,
  "userText": "אני דוחה שיחה חשובה"
}
```

## Response

```json
{
  "response": "Localized coaching text...",
  "source": "local_fallback",
  "prompt": {
    "language": "he",
    "tone": "tony_coach",
    "system": "System prompt...",
    "user": "Structured user prompt..."
  }
}
```

The implementation uses `local_fallback` when `OPENAI_API_KEY` or `OPENAI_MODEL` is missing.

When both environment variables are present, `/api/coach` calls OpenAI's Responses API and returns:

```json
{
  "source": "openai"
}
```

The frontend contract stays the same either way.
