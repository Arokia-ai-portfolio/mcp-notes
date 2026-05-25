#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
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
  { name: "mcp-notes", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "set_context",
      description:
        "Set the active project or conversation context. Once set, all notes saved will belong to this context, and list/search will only show notes from this context. Pass null to clear the context and work across all notes.",
      inputSchema: {
        type: "object" as const,
        properties: {
          name: {
            type: ["string", "null"],
            description: "Project or context name (e.g. 'ecommerce-app', 'work-notes'). Pass null to clear.",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "get_context",
      description: "Get the currently active project context for this conversation.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "save_note",
      description: "Save a new note with a title, content, and optional tags. Automatically assigned to the active context if one is set.",
      inputSchema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Note title (max 200 chars)" },
          content: { type: "string", description: "Note content (max 10,000 chars)" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional tags — alphanumeric, hyphens, underscores only (max 10)",
          },
          context: {
            type: "string",
            description: "Override the active context for this note only (optional)",
          },
        },
        required: ["title", "content"],
      },
    },
    {
      name: "update_note",
      description: "Update the title, content, tags, or context of an existing note by its ID.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Note UUID" },
          title: { type: "string", description: "New title (max 200 chars)" },
          content: { type: "string", description: "New content (max 10,000 chars)" },
          tags: { type: "array", items: { type: "string" }, description: "New tags" },
          context: { type: ["string", "null"], description: "Move note to a different context, or null to remove context" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_note",
      description: "Retrieve the full content of a specific note by its ID.",
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
      description: "List saved notes. By default shows only notes in the active context. Use all=true to show notes from every context.",
      inputSchema: {
        type: "object" as const,
        properties: {
          tag: { type: "string", description: "Filter by tag (optional)" },
          context: { type: "string", description: "Filter by a specific context (optional, overrides active context)" },
          all: { type: "boolean", description: "Set true to show notes from all contexts" },
        },
      },
    },
    {
      name: "search_notes",
      description: "Search notes by keyword. By default searches only within the active context. Use all=true to search across all contexts.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Search keyword (max 200 chars)" },
          all: { type: "boolean", description: "Set true to search across all contexts" },
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
                  ? `You have ${count} note(s) in this context.`
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
          lines.push("No active context — showing notes from all projects.");
          lines.push('Say "I\'m working on [project name]" to filter by project.');
        }

        if (allContexts.length > 0) {
          lines.push(`\nAll saved contexts: ${allContexts.map((c) => `"${c}"`).join(", ")}`);
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
                `Context: ${note.context ?? "none"}`,
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
              text: `Note updated.\nID:      ${note.id}\nTitle:   ${note.title}\nContext: ${note.context ?? "none"}\nUpdated: ${note.updatedAt}`,
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
                `Context: ${note.context ?? "none"}`,
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
          const scope = input.all
            ? "across all contexts"
            : activeCtx
            ? `in context "${activeCtx}"`
            : "across all contexts";
          const hint = !input.all && activeCtx
            ? '\nSay "show all my notes across all projects" to see everything.'
            : "";
          return {
            content: [{ type: "text" as const, text: `No notes found ${scope}.${hint}` }],
          };
        }

        const lines = notes.map(
          (n) =>
            `• [${n.id}] ${n.title}` +
            (n.context ? ` [context: ${n.context}]` : "") +
            (n.tags.length > 0 ? ` [tags: ${n.tags.join(", ")}]` : "") +
            ` — ${n.updatedAt.slice(0, 10)}`
        );

        const scope = input.all ? "all contexts" : activeCtx ? `"${activeCtx}"` : "all contexts";
        return {
          content: [
            {
              type: "text" as const,
              text: `${notes.length} note(s) in ${scope}:\n\n${lines.join("\n")}`,
            },
          ],
        };
      }

      case "search_notes": {
        const input = SearchNotesInputSchema.parse(args);
        const activeCtx = store.getContext();
        const notes = store.search(input.query, input.all);

        if (notes.length === 0) {
          const scope = !input.all && activeCtx ? ` in context "${activeCtx}"` : "";
          const hint = !input.all && activeCtx
            ? '\nSay "search all projects for X" to search everywhere.'
            : "";
          return {
            content: [
              { type: "text" as const, text: `No notes matched "${input.query}"${scope}.${hint}` },
            ],
          };
        }

        const lines = notes.map(
          (n) =>
            `• [${n.id}] ${n.title}` +
            (n.context ? ` [context: ${n.context}]` : "") +
            (n.tags.length > 0 ? ` [${n.tags.join(", ")}]` : "")
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `${notes.length} result(s) for "${input.query}":\n\n${lines.join("\n")}`,
            },
          ],
        };
      }

      case "delete_note": {
        const input = DeleteNoteInputSchema.parse(args);
        const deleted = store.delete(input.id);
        if (!deleted) {
          throw new McpError(ErrorCode.InvalidRequest, `Note not found: ${input.id}`);
        }
        return {
          content: [{ type: "text" as const, text: `Note ${input.id} deleted.` }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    if (err instanceof ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid input: ${err.errors.map((e) => e.message).join(", ")}`
      );
    }
    throw new McpError(ErrorCode.InternalError, safeErrorMessage(err));
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => process.exit(1));
