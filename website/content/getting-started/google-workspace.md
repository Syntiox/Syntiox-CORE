---
title: Google Workspace
description: Connect Gmail, Drive, Docs, Sheets, Slides, Forms, Calendar, and Tasks in Syntiox CORE using your own local OAuth 2.0 Desktop credentials.json.
keywords: Syntiox CORE Google Workspace, OAuth 2.0, credentials.json, Gmail, Google Drive, Google Calendar, Docs, Sheets, MCP
---

# Google Workspace

Syntiox CORE includes built-in MCP servers for eight Google Workspace services so the agent can read and act on your account only when you connect your own OAuth 2.0 Desktop client.

## Setup Steps

1. Open the [Google Cloud Console](https://console.cloud.google.com/), create (or select) a project, and enable the Google APIs you plan to use (such as Gmail, Drive, Docs, Sheets, Slides, Forms, Calendar, or Tasks).
2. Navigate to **APIs & Services > Credentials** and create an **OAuth 2.0 Client ID** with the application type set to **Desktop app**.
3. Download the generated JSON file, rename it to `credentials.json`, and either:
   - Upload it in **Settings** inside Syntiox CORE, or
   - Save it manually to:

```text
%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\credentials.json
```

4. Connect your Google account from the Syntiox CORE UI to complete local authorization.

## Built-in Google Workspace Servers

| Server ID | Service |
| --- | --- |
| `google_gmail` | Gmail messages, search, drafts, labels, and replies |
| `google_drive` | Google Drive file lookup, folders, and management |
| `google_docs` | Google Docs reading and editing |
| `google_sheets` | Google Sheets spreadsheets |
| `google_slides` | Google Slides presentations |
| `google_forms` | Google Forms |
| `google_calendar` | Google Calendar events and scheduling |
| `google_tasks` | Google Tasks lists and items |

You can tune permissions for each built-in server (`allow_ask`, `allow_process`, or `off`) in **Settings > MCP Servers**. For custom servers, read [MCP Servers & Guardrails](../guides/mcp-servers.md).
