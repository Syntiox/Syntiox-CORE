<p align="center">
  <img src="logo.svg" alt="Syntiox CORE Logo" width="300" />
</p>

<h1 align="center">Syntiox CORE</h1>

<p align="center">
  <strong>A local AI Agent OS for Windows, powered by Google Gemini and Groq.</strong>
</p>

---

**Syntiox CORE** runs locally on Windows and helps automate multi-step tasks across files, terminals, web browsers, and Google Workspace using a Desktop App and Web Workspace.

## Features

- **Desktop App & Web Workspace:** Native Windows desktop app with a local web interface.
- **Browser Automation:** Researches, clicks, fills forms, and keeps browser login sessions across runs.
- **Google Workspace Integration:** Works with Gmail, Google Drive, Docs, Sheets, Slides, Forms, Calendar, and Tasks.
- **Extensible with MCP & Skills:** Add external MCP servers and custom markdown skills for your own workflows.
- **API Key Rotation & Memory:** Rotate multiple `GEMINI_API_KEY` or `GROQ_API_KEY` keys automatically and keep conversation history across sessions.

---

## Getting Started

### Prerequisites
- **Windows** (x64) — Python 3.11 is installed automatically during setup if missing.
- A **Gemini API Key** (and optionally a Google Cloud OAuth client for Google Workspace tools).

### 1. Installation

#### Option 1: Windows Installer (Recommended)
Download and run the latest `Syntiox-CORE-Setup-*.exe` from [GitHub Releases](https://github.com/Syntiox/Syntiox-CORE/releases/latest).

#### Option 2: PowerShell Install
Downloads and launches the latest `Syntiox-CORE-Setup-*.exe` automatically:
```powershell
irm https://syntiox.github.io/Syntiox-CORE/install.cmd -OutFile install.cmd ; .\install.cmd
```

### 2. Configure API Keys (`.env`)

Open `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\.env` and add your keys:
- `GEMINI_API_KEY` (supports comma-separated keys for rotation: `key1,key2`)
- Optional model settings: `GOOGLE_MODEL=gemini-3.5-flash-lite`, `THINKING_LEVEL=MEDIUM`
- Optional Groq / search keys: `GROQ_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY`, `WOLFRAM_ALPHA_APPID`

### 3. Google Workspace Setup (Optional)

To connect Gmail, Drive, Docs, Calendar, and other Google Workspace tools:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create a project, and enable the Google APIs you want to use.
2. Under **APIs & Services > Credentials**, create an **OAuth 2.0 Client ID** (**Desktop app**).
3. Download the JSON file, rename it to `credentials.json`, and upload it in **Settings** (or place it in `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\credentials.json`), then connect your Google account from the UI.

---

## Guides

- [Adding & Loading MCP Servers](docs/guides/mcp.md): Connect external MCP servers via the UI or `mcp_servers.json`.
- [Adding Custom Skills & Rules](docs/guides/skills.md): Add custom `SKILL.md` workflows and global rules in `SYNTIOX_CORE.md`.

---

## Usage

Launch **Syntiox CORE** from the Start Menu or Desktop shortcut, or open **Syntiox CORE (Web Workspace)** from the Start Menu to use it in your browser.

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).
