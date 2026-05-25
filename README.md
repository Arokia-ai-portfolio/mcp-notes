# mcp-notes

> Persistent notes for your LLM — save, search, and recall information across every conversation.

Built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), this plugin works with **Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, and any other MCP-compatible AI tool.

> **Does this work with ChatGPT?**
> No. MCP is an open standard created by Anthropic. ChatGPT uses a different system entirely. This plugin works with Claude, Cursor, Windsurf, Cline, and any tool that supports MCP.

---

## Why

LLMs forget everything when a conversation ends. `mcp-notes` gives your AI a place to write things down — decisions, code snippets, reminders, research — and read them back in any future session.

---

## How it works

When you connect this plugin, your LLM gains 6 new tools it can call automatically. You just talk normally — no special commands needed.

**Saving something:**
```
You:    Remember that my server runs on port 3000.
Claude: Got it. [calls save_note]
        Saved — "Server port" (ID: 3f2a1b4c-...)
```

**Recalling later — even days later in a brand new conversation:**
```
You:    What port does my server run on?
Claude: [calls search_notes → finds the note]
        Your server runs on port 3000.
```

**Other things you can say:**
- "Show all my notes"
- "Search my notes for anything about deadlines"
- "Update the server note — it's port 8080 now"
- "Delete the note about port 3000"

The LLM calls the right tool automatically. You never have to mention tool names.

---

## Where are my notes stored?

Notes are saved in a plain JSON file **on your own computer**. Nothing is sent to any server.

| Platform | Location |
|---|---|
| Mac / Linux | `~/.mcp-notes/notes.json` |
| Windows | `C:\Users\<your-name>\.mcp-notes\notes.json` |

**To view your notes directly:**

On Mac, open Terminal and run:
```bash
cat ~/.mcp-notes/notes.json
```

Or in Finder: press `Cmd + Shift + G`, type `~/.mcp-notes/`, and open `notes.json` in any text editor. It's plain readable text — you can edit or delete it at any time.

**Closing a conversation does not delete your notes.** They stay in the file until you explicitly remove them.

---

## You are in full control

| Action | How to do it |
|---|---|
| See all notes | Tell your LLM: "list all my notes" |
| Search notes | Tell your LLM: "search my notes for X" |
| Edit a note | Tell your LLM: "update my note about X" |
| Delete a note | Tell your LLM: "delete the note about X" |
| Wipe everything | Delete the file `~/.mcp-notes/notes.json` |
| Read notes yourself | Open `~/.mcp-notes/notes.json` in any text editor |

No account. No cloud. No dashboard. The file is yours.

---

## mcp-notes vs built-in LLM memory

Some AI tools have their own built-in memory. Here's how `mcp-notes` differs:

| | mcp-notes | Built-in LLM memory |
|---|---|---|
| Stored | On your own computer | On the AI company's servers |
| You can read it | Yes — plain JSON file | Usually no direct access |
| You can edit it | Yes — open in any text editor | Usually no |
| Survives closing chat | Yes, always | Depends on the tool |
| Works across different AI tools | Yes — Claude, Cursor, Windsurf, etc. | No — locked to one tool |
| What gets saved | Only what you explicitly ask to save | What the AI decides to remember |
| Private | Fully — never leaves your machine | Stored on external servers |

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

## Security

- **No network access** — runs entirely locally
- **UUID-based IDs** — note IDs are server-generated UUIDs, never derived from user input
- **Input validation** — all inputs validated with strict schemas
- **ReDoS protection** — search strings are escaped before regex use
- **Atomic writes** — notes file is written via temp-then-rename to prevent corruption
- **Restricted permissions** — storage directory is `0700`, notes file is `0600` (owner-only on Unix)
- **Schema validation on read** — data read from disk is re-validated before use
- **Safe error messages** — file paths and stack traces are never exposed to callers

---

## Development

```bash
git clone https://github.com/Arokia-ai-portfolio/mcp-notes
cd mcp-notes
npm install
npm run build
npm start
```

---

## License

MIT
