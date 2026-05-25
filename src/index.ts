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
  UpdateNoteInputSchema,
} from "./validation.js";

const store = new NoteStore();

const server = new Server(
  { name: "mcp-notes", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "save_note",
      description: "Save a new note with a title, content, and optional tags",
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
        },
        required: ["title", "content"],
      },
    },
    {
      name: "update_note",
      description: "Update the title, content, or tags of an existing note by its ID",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Note UUID" },
          title: { type: "string", description: "New title (max 200 chars)" },
          content: { type: "string", description: "New content (max 10,000 chars)" },
          tags: { type: "array", items: { type: "string" }, description: "New tags" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_note",
      description: "Retrieve the full content of a specific note by its ID",
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
      description: "List all saved notes, optionally filtered by tag",
      inputSchema: {
        type: "object" as const,
        properties: {
          tag: { type: "string", description: "Filter by tag (optional)" },
        },
      },
    },
    {
      name: "search_notes",
      description: "Search notes by keyword across title and content",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Search keyword (max 200 chars)" },
        },
        required: ["query"],
      },
    },
    {
      name: "delete_note",
      description: "Permanently delete a note by its ID",
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
      case "save_note": {
        const input = SaveNoteInputSchema.parse(args);
        const note = store.create(input.title, input.content, input.tags);
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Note saved successfully.`,
                `ID:      ${note.id}`,
                `Title:   ${note.title}`,
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
        });
        if (!note) {
          throw new McpError(ErrorCode.InvalidRequest, `Note not found: ${input.id}`);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Note updated.\nID:      ${note.id}\nTitle:   ${note.title}\nUpdated: ${note.updatedAt}`,
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
        const notes = store.list(input.tag);
        if (notes.length === 0) {
          const msg = input.tag
            ? `No notes found with tag "${input.tag}".`
            : "No notes saved yet.";
          return { content: [{ type: "text" as const, text: msg }] };
        }
        const lines = notes.map(
          (n) =>
            `• [${n.id}] ${n.title}` +
            (n.tags.length > 0 ? ` [${n.tags.join(", ")}]` : "") +
            ` — ${n.updatedAt.slice(0, 10)}`
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `${notes.length} note(s):\n\n${lines.join("\n")}`,
            },
          ],
        };
      }

      case "search_notes": {
        const input = SearchNotesInputSchema.parse(args);
        const notes = store.search(input.query);
        if (notes.length === 0) {
          return {
            content: [
              { type: "text" as const, text: `No notes matched "${input.query}".` },
            ],
          };
        }
        const lines = notes.map(
          (n) =>
            `• [${n.id}] ${n.title}` +
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
