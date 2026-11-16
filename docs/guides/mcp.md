# Adding & Loading MCP Servers

Syntiox CORE supports external Model Context Protocol (MCP) servers alongside its built-in integrations.

## Built-in Integrations

These MCP servers are included out of the box:
- **Google Workspace:** `google_calendar`, `google_docs`, `google_drive`, `google_forms`, `google_gmail`, `google_sheets`, `google_slides`, `google_tasks`
- **Utilities & Sandboxes:** `math_solver`, `python_sandbox`, `nodejs_sandbox`, `mouse_keyboard`

---

## Option 1: Add and Load via the App UI

1. Open **Settings > MCP Servers** in Syntiox CORE.
2. Add a server with:
   - **Name:** Short identifier (letters, numbers, `_`, or `-`)
   - **Command:** Executable to run (e.g. `npx`, `uvx`, `python`, `node`)
   - **Arguments:** Command arguments (one per item/line)
   - **Environment Variables (optional):** API keys or tokens required by the server
3. Save the server. Syntiox CORE syncs and loads its tools automatically.

You can also change tool permissions (`allow_ask`, `allow_process`, or `off`) or click **Sync** in the MCP panel to reload servers after manual edits.

---

## Option 2: Add via `mcp_servers.json`

Edit the configuration file at:

```text
%USERPROFILE%\.sh4lu-z\Syntiox CORE\config\mcp_servers.json
```

### Example Configuration

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "uvx",
      "args": ["mcp-server-sqlite", "--db-path", "C:\\data\\test.db"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    },
    "custom_python": {
      "command": "python",
      "args": ["C:\\Users\\YourName\\.sh4lu-z\\Syntiox CORE\\mcp\\my_server\\server.py"]
    }
  }
}
```

### Storing Local MCP Server Files

If you write or download a custom MCP server locally, you can keep its files inside:

```text
%USERPROFILE%\.sh4lu-z\Syntiox CORE\mcp\<server_name>\
```

### Loading Changes

After editing `mcp_servers.json`, either:
- Click **Sync** in **Settings > MCP Servers**, or
- Restart Syntiox CORE.
