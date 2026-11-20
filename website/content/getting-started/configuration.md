---
title: Configuration (.env)
description: Configure Syntiox CORE with .env settings including GEMINI_API_KEY rotation, GOOGLE_MODEL, THINKING_LEVEL, Groq API keys, and web search providers.
keywords: Syntiox CORE configuration, .env, GEMINI_API_KEY rotation, GOOGLE_MODEL, THINKING_LEVEL, Groq, Tavily, Exa, Firecrawl
---

# Configuration (.env)

After installation, Syntiox CORE reads API keys and model defaults from a local `.env` file on your machine:

```text
%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\.env
```

You can edit this file directly or update keys from **Settings** inside the app.

## Example `.env`

```ini
GEMINI_API_KEY=key1,key2
GOOGLE_MODEL=gemini-3.5-flash-lite
THINKING_LEVEL=MEDIUM

# Optional providers and search tools
GROQ_API_KEY=
TAVILY_API_KEY=
EXA_API_KEY=
FIRECRAWL_API_KEY=
WOLFRAM_ALPHA_APPID=
```

## Configuration Keys

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Primary Google Gemini key; accepts comma-separated keys (`key1,key2`) for automatic rotation |
| `GOOGLE_MODEL` | Optional | Default Gemini model identifier (example: `gemini-3.5-flash-lite`) |
| `THINKING_LEVEL` | Optional | Default reasoning budget (example: `MEDIUM`) |
| `GROQ_API_KEY` | Optional | Groq API key; also supports comma-separated key rotation |
| `TAVILY_API_KEY` | Optional | Search integration key for Tavily |
| `EXA_API_KEY` | Optional | Neural web search integration key for Exa |
| `FIRECRAWL_API_KEY` | Optional | Web scraping/extraction key for Firecrawl |
| `WOLFRAM_ALPHA_APPID` | Optional | Wolfram Alpha integration ID |

## API Key Rotation

When you supply multiple comma-separated keys in `GEMINI_API_KEY` or `GROQ_API_KEY`, Syntiox CORE can rotate across them automatically so long runs keep moving when one key hits a rate limit or quota boundary.

Keep `.env` strictly local—never commit it to Git or share screenshots showing live keys. See [Security & License](../reference/security.md) for safe handling notes.
