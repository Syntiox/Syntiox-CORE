# Desktop & Web UI

Syntiox CORE exposes the same core workspace in both the **Tauri v2 Desktop App** and the **Web Workspace**, designed around rapid inspection and human-in-the-loop control.

## Workspace Layout

- **Session Sidebar:** Create chats, rename or remove saved conversations, search/switch threads, and track active workspace context.
- **Streaming Chat & Trace:** Renders formatted Markdown replies, fenced code blocks with syntax highlighting and one-click copy, inline/display KaTeX math formulas, and collapsible tool execution steps.
- **Split-Pane Workspace Inspector:** Browse project files, preview syntax-highlighted code with line references, view images or Markdown artifacts, and inspect working state alongside the conversation.

## Human-in-the-Loop Controls

| Control | Behavior |
| --- | --- |
| **PowerShell Command Approvals** | Prompts before running shell commands; supports single-run approval, session approval, or whitelist rules |
| **Background Task Monitor** | Inspect running background processes, stream output logs, send stdin input, or stop tasks |
| **MCP Tool Guardrails** | Per-server and per-tool policies (`allow_ask`, `allow_process`, `off`) configurable in Settings |
| **Web Workspace PIN Lock** | Gates browser/LAN sessions behind a local PIN prompt before granting workspace access |

## Chat Slash Commands

You can use quick commands directly from the message composer:

- `/new` — Start a fresh conversation session.
- `/clear` — Clear the active view/conversation state.
- `/reset` — Reset current session state cleanly.
- `/history` — List saved conversation sessions.
- `/load <id>` — Load a previous conversation session by its ID.

See [Commands & Paths](../reference/commands-and-paths.md) for a consolidated reference.
