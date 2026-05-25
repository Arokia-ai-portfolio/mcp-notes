# mcp-notes

> Persistent notes for your LLM — save, search, and recall information across every conversation.

Built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), this plugin works with **Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, and any other MCP-compatible AI tool.

---

## Why

LLMs forget everything when a conversation ends. `mcp-notes` gives your AI a place to write things down — decisions, code snippets, reminders, research — and read them back in any future session.

---

## Install

### Option 1 — npx (no install needed)
```json
{
  "mcpServers": {
    "notes": {
      "command": "npx",
      "args": ["-y", "mcp-notes"]
    }
  }
}
```

### Option 2 — global install
```bash
npm install -g mcp-notes
```
```json
{
  "mcpServers": {
    "notes": {
      "command": "mcp-notes"
    }
  }
}
```

---

## Setup by app

### Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)  
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "notes": {
      "command": "npx",
      "args": ["-y", "mcp-notes"]
    }
  }
}
```
Restart Claude Desktop. You'll see **notes** appear in the MCP tools list.

### Claude Code (CLI)
```bash
claude mcp add notes -- npx -y mcp-notes
```

### Cursor / Windsurf
Add the same JSON block to your MCP settings file in the app's settings panel.

---

## Tools

Once installed, your LLM can use these tools automatically:

| Tool | What it does |
|---|---|
| `save_note` | Save a new note with title, content, and optional tags |
| `get_note` | Retrieve a note by ID |
| `list_notes` | List all notes, optionally filtered by tag |
| `search_notes` | Search notes by keyword across title and content |
| `update_note` | Update an existing note |
| `delete_note` | Delete a note by ID |

### Example conversation
```
You:     Remember that the API rate limit is 1000 req/min for the free tier.

Claude:  [calls save_note]
         Note saved.
         ID: 3f2a1b4c-...
         Title: API rate limit — free tier
         Tags: api, limits

--- next conversation, days later ---

You:     What was the rate limit again?

Claude:  [calls search_notes with "rate limit"]
         Found 1 result: "API rate limit — free tier"
         The rate limit is 1,000 requests/minute on the free tier.
```

---

## Where notes are stored

Notes are saved locally on your machine at:

- **Mac/Linux:** `~/.mcp-notes/notes.json`
- **Windows:** `C:\Users\<you>\.mcp-notes\notes.json`

No data is sent to any server. Everything stays on your device.

---

## Security

- **No network access** — runs entirely locally
- **UUID-based IDs** — note IDs are server-generated UUIDs, never derived from user input
- **Input validation** — all inputs validated with strict schemas (Zod)
- **ReDoS protection** — search strings are regex-escaped before use
- **Atomic writes** — notes file is written via temp-then-rename to prevent corruption
- **Restricted permissions** — storage directory is `0700`, notes file is `0600` (owner-only on Unix)
- **Schema validation on read** — data read from disk is re-validated before use
- **Safe error messages** — file paths and stack traces are never exposed to callers

---

## Limits

| Limit | Value |
|---|---|
| Max notes | 1,000 |
| Max title length | 200 characters |
| Max content length | 10,000 characters |
| Max tags per note | 10 |
| Max tag length | 50 characters |
| Tag format | Alphanumeric, hyphens, underscores |

---

## Development

```bash
git clone https://github.com/YOUR_USERNAME/mcp-notes
cd mcp-notes
npm install
npm run build
npm start
```

---

## License

MIT
