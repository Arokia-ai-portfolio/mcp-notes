#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { NoteStore } from "./notes.js";
import { safeErrorMessage } from "./security.js";
import {
  DeleteNoteInputSchema,
  GetNoteInputSchema,
  ListNotesInputSchema,
  SaveNoteInputSchema,
  SearchNotesInputSchema,
  SetContextInputSchema,
  UpdateNoteInputSchema,
} from "./validation.js";

const store = new NoteStore();

const server = new Server(
  { name: "mcp-notes", version: "1.2.0" },
  { capabilities: { tools: {}, resources: {} } }
);

// ---------------------------------------------------------------------------
// RESOURCES — auto-loaded at conversation start, titles only, no content
// Personal note content is NEVER included here — it only flows to the LLM
// when the user explicitly asks for a specific note via get_note / search_notes
// ---------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const contexts = store.listContexts();
  return {
    resources: [
      {
        uri: "notes://index",
        name: "My Notes Index",
        description:
          "Titles and topics of all your saved notes. " +
          "Note content is never included here to protect your privacy. " +
          "Use get_note or search_notes to read the content of a specific note.",
        mimeType: "text/plain",
      },
      ...contexts.map((ctx) => ({
        uri: `notes://context/${encodeURIComponent(ctx)}`,
        name: `Notes: ${ctx}`,
        description: `Note titles saved under the topic "${ctx}". No content included.`,
        mimeType: "text/plain",
      })),
    ],
  };
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    {
      uriTemplate: "notes://context/{name}",
      name: "Notes by topic",
      description: "Note titles for a specific topic. No content included.",
      mimeType: "text/plain",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // --- notes://index — all notes, titles only, grouped by topic ---
  if (uri === "notes://index") {
    const all = store.list(undefined, undefined, true);

    if (all.length === 0) {
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: 'No notes saved yet. Say "remember that..." to save your first note.',
          },
        ],
      };
    }

    // Group by context
    const byContext = new Map<string, typeof all>();
    const noContext: typeof all = [];
    for (const note of all) {
      if (note.context) {
        if (!byContext.has(note.context)) byContext.set(note.context, []);
        byContext.get(note.context)!.push(note);
      } else {
        noContext.push(note);
      }
    }

    const lines: string[] = [
      `${all.length} saved note(s) — titles only. Content is not shown here to protect your privacy.`,
      `To read a note say: "show me the note about [title]"`,
      ``,
    ];

    for (const [ctx, notes] of byContext) {
      lines.push(`[${ctx}]`);
      for (const n of notes) {
        lines.push(`  • ${n.title} — saved ${n.updatedAt.slice(0, 10)}`);
      }
      lines.push("");
    }

    if (noContext.length > 0) {
      lines.push("[No topic]");
      for (const n of noContext) {
        lines.push(`  • ${n.title} — saved ${n.updatedAt.slice(0, 10)}`);
      }
    }

    return {
      contents: [{ uri, mimeType: "text/plain", text: lines.join("\n").trim() }],
    };
  }

  // --- notes://context/{name} — titles for one topic ---
  const contextMatch = uri.match(/^notes:\/\/context\/(.+)$/);
  if (contextMatch) {
    const contextName = decodeURIComponent(contextMatch[1] ?? "");
    const notes = store.list(undefined, contextName);

    if (notes.length === 0) {
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: `No notes saved under "${contextName}".`,
          },
        ],
      };
    }

    const lines = [
      `${notes.length} note(s) in "${contextName}" — titles only, no content.`,
      `To read a note say: "show me the note about [title]"`,
      ``,
      ...notes.map((n) => `• ${n.title} — saved ${n.updatedAt.slice(0, 10)}`),
    ];

    return {
      contents: [{ uri, mimeType: "text/plain", text: lines.join("\n") }],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
});

// ---------------------------------------------------------------------------
// TOOLS — called on demand, content only flows when user explicitly asks
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "set_context",
      description:
        "Set the active topic or project for this conversation. All notes saved will be filed under this topic, and list/search will only show notes from this topic. Pass null to clear.",
      inputSchema: {
        type: "object" as const,
        properties: {
          name: {
            type: ["string", "null"],
            description: "Topic name (e.g. 'Japan trip', 'work', 'fitness'). Pass null to clear.",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "get_context",
      description: "Get the currently active topic and list all saved topics.",
      inputSchema: { type: "object" as const, properties: {} },
    },
    {
      name: "save_note",
      description:
        "Save a new note. Automatically filed under the active topic if one is set.",
      inputSchema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Note title (max 200 chars)" },
          content: { type: "string", description: "Note content (max 10,000 chars)" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional tags (max 10)",
          },
          context: {
            type: "string",
            description: "Override the active topic for this note only (optional)",
          },
        },
        required: ["title", "content"],
      },
    },
    {
      name: "update_note",
      description: "Update the title, content, tags, or topic of an existing note.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Note UUID" },
          title: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          context: { type: ["string", "null"], description: "Move to a different topic, or null to remove topic" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_note",
      description: "Retrieve the full content of a specific note by its ID. Only call this when the user explicitly asks to read a note — do not call proactively.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Note UUID" },
        },
        required: ["id"],
      },
    },
    {
      name: "list_notes",
      description:
        "List saved notes. By default shows only notes in the active topic. Use all=true to show notes from every topic.",
      inputSchema: {
        type: "object" as const,
        properties: {
          tag: { type: "string", description: "Filter by tag (optional)" },
          context: { type: "string", description: "Filter by a specific topic (optional)" },
          all: { type: "boolean", description: "Set true to show notes from all topics" },
        },
      },
    },
    {
      name: "search_notes",
      description:
        "Search notes by keyword. By default searches only within the active topic. Use all=true to search across all topics.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Search keyword (max 200 chars)" },
          all: { type: "boolean", description: "Set true to search across all topics" },
        },
        required: ["query"],
      },
    },
    {
      name: "delete_note",
      description: "Permanently delete a note by its ID.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Note UUID" },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "set_context": {
        const input = SetContextInputSchema.parse(args);
        store.setContext(input.name);
        if (input.name === null) {
          return {
            content: [{ type: "text" as const, text: "Context cleared. All notes are now visible." }],
          };
        }
        const count = store.list(undefined, input.name).length;
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Context set to: "${input.name}"`,
                count > 0
                  ? `You have ${count} note(s) in this topic.`
                  : `No notes yet in "${input.name}". Start saving and they'll appear here.`,
              ].join("\n"),
            },
          ],
        };
      }

      case "get_context": {
        const ctx = store.getContext();
        const allContexts = store.listContexts();
        const lines: string[] = [];
        if (ctx) {
          lines.push(`Active context: "${ctx}"`);
        } else {
          lines.push("No active context — showing notes from all topics.");
          lines.push('Say "I\'m working on [topic]" to filter by topic.');
        }
        if (allContexts.length > 0) {
          lines.push(`\nAll saved topics: ${allContexts.map((c) => `"${c}"`).join(", ")}`);
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      case "save_note": {
        const input = SaveNoteInputSchema.parse(args);
        const note = store.create(input.title, input.content, input.tags, input.context);
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Note saved.`,
                `ID:      ${note.id}`,
                `Title:   ${note.title}`,
                `Topic:   ${note.context ?? "none"}`,
                `Tags:    ${note.tags.length > 0 ? note.tags.join(", ") : "none"}`,
                `Created: ${note.createdAt}`,
              ].join("\n"),
            },
          ],
        };
      }

      case "update_note": {
        const input = UpdateNoteInputSchema.parse(args);
        const note = store.update(input.id, {
          title: input.title,
          content: input.content,
          tags: input.tags,
          context: input.context,
        });
        if (!note) {
          throw new McpError(ErrorCode.InvalidRequest, `Note not found: ${input.id}`);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Note updated.\nID:      ${note.id}\nTitle:   ${note.title}\nTopic:   ${note.context ?? "none"}\nUpdated: ${note.updatedAt}`,
            },
          ],
        };
      }

      case "get_note": {
        const input = GetNoteInputSchema.parse(args);
        const note = store.get(input.id);
        if (!note) {
          throw new McpError(ErrorCode.InvalidRequest, `Note not found: ${input.id}`);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `**${note.title}**`,
                `ID:      ${note.id}`,
                `Topic:   ${note.context ?? "none"}`,
                `Tags:    ${note.tags.length > 0 ? note.tags.join(", ") : "none"}`,
                `Created: ${note.createdAt}`,
                `Updated: ${note.updatedAt}`,
                ``,
                note.content,
              ].join("\n"),
            },
          ],
        };
      }

      case "list_notes": {
        const input = ListNotesInputSchema.parse(args);
        const activeCtx = store.getContext();
        const notes = store.list(input.tag, input.context, input.all);
        if (notes.length === 0) {
          const scope = input.all ? "across all topics" : activeCtx ? `in topic "${activeCtx}"` : "across all topics";
          const hint = !input.all && activeCtx ? '\nSay "show all my notes across all topics" to see everything.' : "";
          return { content: [{ type: "text" as const, text: `No notes found ${scope}.${hint}` }] };
        }
        const lines = notes.map(
          (n) =>
            `• [${n.id}] ${n.title}` +
            (n.context ? ` [topic: ${n.context}]` : "") +
            (n.tags.length > 0 ? ` [tags: ${n.tags.join(", ")}]` : "") +
            ` — ${n.updatedAt.slice(0, 10)}`
        );
        const scope = input.all ? "all topics" : activeCtx ? `"${activeCtx}"` : "all topics";
        return {
          content: [{ type: "text" as const, text: `${notes.length} note(s) in ${scope}:\n\n${lines.join("\n")}` }],
        };
      }

      case "search_notes": {
        const input = SearchNotesInputSchema.parse(args);
        const activeCtx = store.getContext();
        const notes = store.search(input.query, input.all);
        if (notes.length === 0) {
          const scope = !input.all && activeCtx ? ` in topic "${activeCtx}"` : "";
          const hint = !input.all && activeCtx ? '\nSay "search all topics for X" to search everywhere.' : "";
          return { content: [{ type: "text" as const, text: `No notes matched "${input.query}"${scope}.${hint}` }] };
        }
        const lines = notes.map(
          (n) =>
            `• [${n.id}] ${n.title}` +
            (n.context ? ` [topic: ${n.context}]` : "") +
            (n.tags.length > 0 ? ` [${n.tags.join(", ")}]` : "")
        );
        return {
          content: [{ type: "text" as const, text: `${notes.length} result(s) for "${input.query}":\n\n${lines.join("\n")}` }],
        };
      }

      case "delete_note": {
        const input = DeleteNoteInputSchema.parse(args);
        const deleted = store.delete(input.id);
        if (!deleted) {
          throw new McpError(ErrorCode.InvalidRequest, `Note not found: ${input.id}`);
        }
        return { content: [{ type: "text" as const, text: `Note ${input.id} deleted.` }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    if (err instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid input: ${err.errors.map((e) => e.message).join(", ")}`);
    }
    throw new McpError(ErrorCode.InternalError, safeErrorMessage(err));
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => process.exit(1));
