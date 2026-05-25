import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { escapeRegex } from "./security.js";

const MAX_NOTES = 1_000;

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  context: string | null;
  createdAt: string;
  updatedAt: string;
}

const StoredNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10_000),
  tags: z.array(z.string().max(50)).max(10),
  // default(null) handles old notes saved before context was added
  context: z.string().max(100).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const NotesStoreSchema = z.object({
  version: z.literal(1),
  notes: z.array(StoredNoteSchema),
});

type NotesStore = z.infer<typeof NotesStoreSchema>;

function storagePaths(): { dir: string; file: string } {
  const dir = join(homedir(), ".mcp-notes");
  return { dir, file: join(dir, "notes.json") };
}

export class NoteStore {
  private readonly paths = storagePaths();
  private activeContext: string | null = null;

  constructor() {
    this.ensureDir();
  }

  // --- Context management (in-memory, per conversation session) ---

  setContext(name: string | null): void {
    this.activeContext = name;
  }

  getContext(): string | null {
    return this.activeContext;
  }

  listContexts(): string[] {
    const store = this.load();
    const seen = new Set<string>();
    for (const note of store.notes) {
      if (note.context) seen.add(note.context);
    }
    return Array.from(seen).sort();
  }

  // --- Storage helpers ---

  private ensureDir(): void {
    if (!existsSync(this.paths.dir)) {
      mkdirSync(this.paths.dir, { recursive: true, mode: 0o700 });
    }
  }

  private load(): NotesStore {
    if (!existsSync(this.paths.file)) {
      return { version: 1, notes: [] };
    }
    try {
      const raw = readFileSync(this.paths.file, { encoding: "utf8" });
      const parsed: unknown = JSON.parse(raw);
      return NotesStoreSchema.parse(parsed);
    } catch {
      return { version: 1, notes: [] };
    }
  }

  private persist(store: NotesStore): void {
    const tmp = `${this.paths.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(tmp, this.paths.file);
  }

  // --- CRUD ---

  create(title: string, content: string, tags: string[], context?: string): Note {
    const store = this.load();
    if (store.notes.length >= MAX_NOTES) {
      throw new Error("Note limit reached (1,000 notes maximum)");
    }
    const now = new Date().toISOString();
    const note: Note = {
      id: uuidv4(),
      title,
      content,
      tags,
      // explicit context arg wins; fall back to active session context
      context: context !== undefined ? context : this.activeContext,
      createdAt: now,
      updatedAt: now,
    };
    store.notes.push(note);
    this.persist(store);
    return note;
  }

  update(id: string, updates: Partial<Pick<Note, "title" | "content" | "tags" | "context">>): Note | null {
    const store = this.load();
    const idx = store.notes.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    const existing = store.notes[idx];
    if (!existing) return null;

    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    ) as Partial<Pick<Note, "title" | "content" | "tags" | "context">>;

    const updated: Note = {
      ...existing,
      ...safeUpdates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    store.notes[idx] = updated;
    this.persist(store);
    return updated;
  }

  get(id: string): Note | null {
    const store = this.load();
    return store.notes.find((n) => n.id === id) ?? null;
  }

  list(tag?: string, contextOverride?: string, all?: boolean): Note[] {
    const store = this.load();
    let notes = store.notes;

    if (tag) {
      notes = notes.filter((n) => n.tags.includes(tag));
    }

    if (!all) {
      const ctx = contextOverride !== undefined ? contextOverride : this.activeContext;
      if (ctx !== null) {
        notes = notes.filter((n) => n.context === ctx);
      }
    }

    return notes;
  }

  search(query: string, all?: boolean): Note[] {
    const store = this.load();
    const pattern = new RegExp(escapeRegex(query), "i");
    let notes = store.notes.filter((n) => pattern.test(n.title) || pattern.test(n.content));

    if (!all && this.activeContext !== null) {
      notes = notes.filter((n) => n.context === this.activeContext);
    }

    return notes;
  }

  delete(id: string): boolean {
    const store = this.load();
    const before = store.notes.length;
    store.notes = store.notes.filter((n) => n.id !== id);
    if (store.notes.length === before) return false;
    this.persist(store);
    return true;
  }
}
