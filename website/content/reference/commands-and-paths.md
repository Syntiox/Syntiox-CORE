# Commands & Paths

Quick reference for Windows configuration locations and chat composer commands.

## Windows Configuration Paths

All user configuration, MCP setups, and custom skills stay isolated under `%USERPROFILE%\.sh4lu-z\Syntiox CORE\`:

| Path | Purpose | Guide |
| --- | --- | --- |
| `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\.env` | API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, search keys) & model defaults | [Configuration (.env)](../getting-started/configuration.md) |
| `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\credentials.json` | Optional Google Cloud OAuth 2.0 Desktop client | [Google Workspace](../getting-started/google-workspace.md) |
| `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\mcp_servers.json` | Custom external stdio MCP server definitions | [MCP Servers & Guardrails](../guides/mcp-servers.md) |
| `%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\SYNTIOX_CORE.md` | Global instructions applied across sessions (up to 2,000 words) | [Skills & Global Rules](../guides/skills-and-rules.md) |
| `%USERPROFILE%\.sh4lu-z\Syntiox CORE\mcp\<server_name>\` | Local folder for custom MCP server source files | [MCP Servers & Guardrails](../guides/mcp-servers.md) |
| `%USERPROFILE%\.sh4lu-z\Syntiox CORE\skills\<skill_name>\SKILL.md` | Reusable markdown skills | [Skills & Global Rules](../guides/skills-and-rules.md) |

## Chat Slash Commands

| Command | Action |
| --- | --- |
| `/new` | Start a new conversation session |
| `/clear` | Clear active conversation view |
| `/reset` | Reset the current session state |
| `/history` | View saved conversation history |
| `/load <id>` | Load an existing conversation session by ID |

See [Desktop & Web UI](../architecture/workspace-ui.md) for UI shortcuts and inspector controls.
