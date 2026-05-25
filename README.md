# mcp-memory-notes

> Give your AI a memory — save anything across every conversation, forever.

Your AI forgets everything the moment you close a chat. `mcp-memory-notes` fixes that. It lets your AI remember things you tell it — and recall them days, weeks, or months later in any new conversation.

Works with **Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, and any MCP-compatible AI tool.

> **Does this work with ChatGPT?**
> No. This uses the Model Context Protocol (MCP), which ChatGPT does not support. It works with Claude, Cursor, Windsurf, Cline, and any tool that supports MCP.

---

## Real examples — what people actually save

Here's what a normal day looks like with `mcp-memory-notes`:

**Remembering personal things:**
```
You:    Remember that my mum's birthday is March 15 and she loves flowers.
Claude: Saved — "Mum's birthday"

--- weeks later, new conversation ---

You:    My mum's birthday is coming up, what should I get her?
Claude: Based on your note, her birthday is March 15 and she loves flowers.
        Here are some gift ideas...
```

**Planning a trip:**
```
You:    I'm planning my Japan trip.
Claude: Got it — context set to "Japan trip". You have 4 notes here.

You:    Remember that flights are cheapest if booked on a Tuesday.
Claude: Saved.

You:    Note that we need a tourist visa — apply at least 6 weeks before.
Claude: Saved.

--- next day ---

You:    I'm planning my Japan trip.
Claude: Context set. You have 6 notes. What do you need?

You:    What do I need to do before I fly?
Claude: From your notes: apply for a tourist visa at least 6 weeks before,
        and book flights on a Tuesday for the cheapest prices.
```

**Work and meetings:**
```
You:    Remember that my manager Sarah prefers feedback in writing, not in meetings.
Claude: Saved — "Manager preference"

You:    Note that the team standup moved to 9am starting next Monday.
Claude: Saved — "Standup time change"

--- days later ---

You:    I need to give Sarah some feedback, how should I approach it?
Claude: From your notes, Sarah prefers feedback in writing rather than in meetings.
```

**Health and daily life:**
```
You:    Remember that my doctor said to take vitamin D every morning with food.
Claude: Saved.

You:    Note that my next dentist appointment is June 20 at 2pm.
Claude: Saved.

You:    Don't forget — my gym locker combination is 14-32-07.
Claude: Saved.
```

---

## Organising notes by topic (contexts)

If you chat about different topics — your trip, your job, your health — use **contexts** to keep them separated. A context is just a label for a topic or project.

**At the start of a conversation, just say what you're doing:**
```
"I'm planning my Japan trip"
"Help me with my job search"
"Let's talk about my kitchen renovation"
"I'm tracking my fitness goals"
```

The AI sets the context automatically. All notes you save go under that topic. When you come back tomorrow and say the same thing, your notes are all there waiting.

**To see everything across all topics:**
```
"Show all my notes across all topics"
"Search everything for: dentist"
```

**To switch topics mid-conversation:**
```
"Switch to my job search notes"
"I want to talk about my Japan trip now"
```

---

## How notes reach the AI — and what stays private

This is important to understand.

**At the start of every conversation, the AI automatically sees:**
- A list of your note **titles** grouped by topic
- Just the titles — nothing else

```
3 saved notes:

[Japan trip]
  • Cheapest flight days — saved 2026-05-20
  • Visa requirements — saved 2026-05-21

[Health]
  • Morning vitamins — saved 2026-05-22
```

The AI now knows what notes exist. It can say *"You have a note about Japan visa requirements — want me to read it?"*

**What never goes to the AI automatically:**
- The content of any note
- Your actual saved information

Note content only flows to the AI when you explicitly ask:
```
"Show me the Japan visa note"
"What did I save about my vitamins?"
"Read the note about cheapest flights"
```

Only that one note's content is sent — nothing else.

**Why this matters:**
Your notes might contain passwords, health information, personal details, or financial info. None of that is ever pushed to the AI without you asking. You stay in control of what the AI actually reads.

---

## How to make the AI ask automatically

Add this one line to your Claude custom instructions (Settings → Custom Instructions) so the AI asks at the start of every new chat without you having to remember:

```
At the start of each new conversation, ask me what I would like to talk about or
work on today, then call set_context with my answer before doing anything else.
```

After that, every new conversation starts like:
```
Claude: What are you working on today?
You:    My Japan trip.
Claude: Context set — you have 8 notes about your Japan trip. How can I help?
```

---

## What phrases trigger a save?

There are no special commands. Just talk naturally. Any of these work:

| What you say | What happens |
|---|---|
| "Remember that..." | Saves a note |
| "Don't forget..." | Saves a note |
| "Note that..." | Saves a note |
| "Save this: ..." | Saves a note |
| "Keep in mind..." | Saves a note |
| "Show all my notes" | Lists your notes |
| "What do I know about X?" | Searches your notes |
| "Search for anything about X" | Searches your notes |
| "Update the note about X" | Updates a note |
| "Delete the note about X" | Deletes a note |

If you're just having a normal conversation, the AI won't save anything unless it clearly makes sense to.

---

## Can the plugin author see your notes or conversations?

**No.** There is no server, no account, no analytics. The plugin runs entirely on your own machine. Your notes are saved to a file on your computer — nobody else can see them, including the person who built this plugin.

---

## Where are my notes stored?

Notes are saved in a plain text file on **your own computer**. Nothing is sent anywhere.

| Platform | Location |
|---|---|
| Mac / Linux | `~/.mcp-notes/notes.json` |
| Windows | `C:\Users\<your-name>\.mcp-notes\notes.json` |

**To read your notes file on Mac:**
Open Terminal and type:
```bash
cat ~/.mcp-notes/notes.json
```

Or in Finder: press `Cmd + Shift + G`, paste `~/.mcp-notes/`, open `notes.json` in any text editor. It's plain readable text you can edit directly.

**Closing a conversation does not delete your notes.** They stay until you remove them.

---

## You are in full control

| What you want to do | How |
|---|---|
| See all your notes | "Show all my notes" |
| Find a specific note | "Search for anything about my dentist" |
| Update a note | "Update my Japan trip note about visas" |
| Delete a note | "Delete the note about my locker combination" |
| Wipe everything | Delete the file `~/.mcp-notes/notes.json` |
| Read notes without AI | Open `~/.mcp-notes/notes.json` in any text editor |

No account. No cloud. No subscription. The file is yours.

---

## mcp-memory-notes vs built-in AI memory

Some AI tools have their own built-in memory. Here's how `mcp-memory-notes` is different:

| | mcp-memory-notes | Built-in AI memory |
|---|---|---|
| Stored | On your own computer | On the AI company's servers |
| You can read it | Yes — it's a plain file you can open | Usually no |
| You can edit it | Yes — open in any text editor | Usually no |
| Survives closing the chat | Yes, always | Depends on the tool |
| Works across different AI tools | Yes — Claude, Cursor, Windsurf, etc. | No — locked to one tool |
| What gets saved | Only what you tell it to save | What the AI decides |
| Private | Fully — never leaves your machine | Stored on external servers |

---

## Install

### Option 1 — npx (no install needed)
```json
{
  "mcpServers": {
    "notes": {
      "command": "npx",
      "args": ["-y", "mcp-memory-notes"]
    }
  }
}
```

### Option 2 — global install
```bash
npm install -g mcp-memory-notes
```
```json
{
  "mcpServers": {
    "notes": {
      "command": "mcp-memory-notes"
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
      "args": ["-y", "mcp-memory-notes"]
    }
  }
}
```
Restart Claude Desktop. You'll see **notes** appear in the MCP tools list.

### Claude Code (CLI)
```bash
claude mcp add notes -- npx -y mcp-memory-notes
```

### Cursor / Windsurf
Add the same JSON block to your MCP settings file in the app's settings panel.

---

## Tools

| Tool | What it does |
|---|---|
| `set_context` | Set the active topic for this conversation |
| `get_context` | Show the current topic and all saved topics |
| `save_note` | Save a note — automatically filed under the active topic |
| `get_note` | Retrieve a note by ID |
| `list_notes` | List notes (shows current topic by default) |
| `search_notes` | Search notes by keyword (current topic by default) |
| `update_note` | Update a note or move it to a different topic |
| `delete_note` | Delete a note permanently |

---

## Limits

| Limit | Value |
|---|---|
| Max notes | 1,000 |
| Max title length | 200 characters |
| Max content length | 10,000 characters |
| Max tags per note | 10 |
| Max tag length | 50 characters |

---

## Security

- **No network access** — runs entirely locally
- **No account required** — nothing to sign up for
- **Input validation** — all inputs validated with strict schemas
- **Atomic writes** — notes file uses safe write pattern to prevent corruption
- **Owner-only file permissions** — your notes file is private to your user account
- **Safe error messages** — no internal details ever exposed

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
