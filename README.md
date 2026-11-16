<p align="center">
  <img src="logo.svg" alt="Syntiox CORE Logo" width="300" />
</p>

<h1 align="center">Syntiox CORE</h1>

<p align="center">
  <strong>An Advanced Agentic AI OS running locally on your machine, powered by Google LLMs.</strong>
</p>

---

**Syntiox CORE** is an autonomous, on-demand Agentic AI system that dynamically routes user intents, leverages deep context memory, and controls complex subsystems—including a fully interactive browser subagent—to accomplish sophisticated, multi-step tasks on your behalf. 

Built exclusively around **Google's LLM ecosystem** (Gemini/Gemma), Syntiox CORE utilizes native Function Calling, Vision, and an Antigravity-style lazy MCP & on-demand skills architecture to manage 130+ tools without exceeding token limits.

## ✨ Key Features

### 🔌 Lazy-Loaded MCP & On-Demand Skills
Syntiox CORE provides **21 lightweight Core Tools** loaded natively into the agent loop. Over **130+ specialized tools** across 11 built-in MCP servers (Google Workspace, Math Solver, Python and Node.js sandboxes) and user-defined servers are lazily indexed with auto-generated JSON schemas (`mcp/mcp_schemas/<server>/<tool>.json`). The agent inspects tool schemas on-demand via `view_file` and executes them via `call_mcp_tool`, minimizing prompt token consumption.

Domain workflows (such as Git commands, document processing, and semantic search) are organized into modular `SKILL.md` files. Base reasoning and memory skills load automatically, while domain-specific guidelines are indexed and read on demand.

### 🌐 Autonomous Browser Subagent
Automates persistent web browsers natively using Playwright and CDP (Chrome DevTools Protocol). 
- Maintains active tabs, isolated sessions, and handles authentication cookies across reboots.
- Injects a beautiful custom UI overlay into the browser to display real-time agent logs and status directly over the web pages it controls.
- Can independently research, click, type, and extract information across multiple tabs with robust task checklists and memory preservation.

### 🏢 Deep Google Workspace Integration
Natively reads, writes, and manages your digital life via an integrated Google MCP architecture:
- **Google Docs:** Create, edit, replace text, and extract data.
- **Google Drive:** Upload, download, manage permissions, and organize folders.
- **Google Forms:** Generate forms, add dynamic questions, and read responses.
- **Gmail & Calendar:** Read, send emails, organize labels, and manage events.

### 💾 Persistent Context Memory & Loop Compaction
Maintains context across sessions for highly personalized responses. Utilizes robust deterministic loop compaction and dynamic memory distillation to keep long-running tasks stable without exceeding context limits, isolating memory into dedicated folders (`create_project_brain`).

### 🛡️ Enterprise-Grade Resilience
- **API Key Rotation:** Gracefully rotates between multiple `GEMINI_API_KEY`s and Groq keys to bypass rate limits (429/Quota Exhausted).
- **Self-Healing Execution:** The execution loop detects malformed API responses or hallucinated tools and automatically injects recovery prompts to stabilize the agent.
- **Secure Background Server & Desktop App:** Runs seamlessly as a FastAPI daemon on Windows with a native Tauri v2 Desktop App and Web Workspace interface.

---

## 🚀 Getting Started

### Prerequisites
- **Windows OS** (x64)
- **Python 3.11** (installed automatically during setup if missing)
- A **Google Cloud Project** for OAuth (Workspace tools) and Gemini API access.

### 1. Installation

#### Option 1: Windows Installer (Recommended)
Download and run the latest `Syntiox-CORE-Setup-*.exe` from [GitHub Releases](https://github.com/Syntiox/Syntiox-CORE/releases/latest).

This installs `syntiox-core.exe` (Desktop App) and `syntioxcore-server.exe` into `%LOCALAPPDATA%\.sh4lu-z\Syntiox CORE`, sets up the Python 3.11 `venv`, and exposes the global `stx` CLI command.

#### Option 2: PowerShell CLI Install
```powershell
irm https://raw.githubusercontent.com/Syntiox/Syntiox-CORE/master/install.cmd -OutFile install.cmd ; .\install.cmd
```

### 2. Configure Environment Variables (`.env`)

After installation, your configuration files are stored securely in your Windows user directory.

1. Navigate to: `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config` 
2. Open `.env` (automatically copied from `.env.example`) and configure your settings:
   - Provide your `GEMINI_API_KEY` (You can comma-separate multiple keys for auto-rotation: `key1,key2`).
   - Configure the target model and reasoning effort: `GOOGLE_MODEL=gemini-3.5-flash-lite`, `THINKING_LEVEL=MEDIUM`.

### 3. Configure Google Workspace Credentials (Optional)

If you want the agent to interact with your personal Google Drive, Gmail, Docs, etc., you must provide an OAuth Client ID from Google Cloud Console.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the APIs you need (Gmail, Drive, Docs, Forms, etc.).
3. Go to **APIs & Services > Credentials** and create an **OAuth 2.0 Client ID** (Desktop Application).
4. Download the JSON file, rename it to `credentials.json`, and place it in the config directory: `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\credentials.json`.
5. Run `stx-google-login` in your terminal to authenticate the agent.

### 4. Customizing Agent Behavior (SYNTIOX_CORE.md)

To give the agent custom rules, coding styles, or system-wide constraints, edit `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\SYNTIOX_CORE.md`. Instructions placed here are automatically injected into the agent's system prompt (up to a 2,000-word limit to prevent prompt bloating and context overflow).

### 5. Adding Custom MCP Servers & Skills

- **Custom MCP Servers**: Register external servers in `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\mcp_servers.json`.
- **Domain Skills**: Add custom `SKILL.md` workflows inside `%USERPROFILE%\.sh4lu-z\Syntiox CORE\skills\<skill_name>\`.

For full configuration format and examples, see the [User Guides](docs/guides/README.md).

---

## 📚 Documentation

Comprehensive documentation is organized across dedicated guides in [docs](docs/):
- [Architecture Overview](docs/architecture/README.md): Lazy-loaded MCP, 21 Core Tools, and the Unified Agent Loop.
- [User Guides](docs/guides/README.md): Setup instructions for custom MCP servers and domain skills.
- [Developer Guide](docs/development/README.md): Local development setup, running tests, adding tools, and contribution workflow.

---

## 💻 Usage

Once installed, you can command your agent from anywhere using the `stx` global command!

### Desktop App / Web Workspace Mode
```bash
stx
```
Launches the Syntiox CORE Tauri v2 Desktop App (if built) or opens the Web Workspace in your browser (`stx --web`). If no background server is running, it starts one automatically.

### Persistent Daemon Mode (Recommended)
```bash
stx --background
```
Launches the FastAPI backend silently in the background and **adds it to your Windows Startup folder** so the agent boots automatically when you turn on your PC. It will continue running even if you close the terminal.

### Stop Background Daemon
```bash
stx --stop
```
Gracefully kills the persistent background server and removes it from the Windows Startup folder.

### Update Syntiox CORE
```bash
stx --update
```
Stops running Syntiox CORE processes, downloads the latest `syntiox-core.exe`, `syntioxcore-server.exe`, and `requirements.txt` from [Syntiox/Syntiox-CORE Releases](https://github.com/Syntiox/Syntiox-CORE/releases/latest), syncs Python dependencies in `venv`, and launches the updated Desktop App.

### Debug Mode & Live Logs
```bash
stx --logs
```
Streams live internal router logs, API requests, and error traces directly to your terminal. If a background server is already running, this will attach to it; otherwise, it starts a new server.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
