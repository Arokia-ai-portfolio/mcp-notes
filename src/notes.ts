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
  createdAt: string;
  updatedAt: string;
}

// Re-validate every note read from disk — guards against manual file edits
// that could smuggle in oversized or malformed data
const StoredNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10_000),
  tags: z.array(z.string().max(50)).max(10),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const NotesStoreSchema = z.object({
  version: z.literal(1),
  notes: z.array(StoredNoteSchema),
});

type NotesStore = z.infer<typeof NotesStoreSchema>;

function storagePaths(): { dir: string; file: string } {
  // homedir() is OS-provided — never user-controlled input
  const dir = join(homedir(), ".mcp-notes");
  return { dir, file: join(dir, "notes.json") };
}

export class NoteStore {
  private readonly paths = storagePaths();

  constructor() {
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.paths.dir)) {
      // mode 0o700: only the owning user can read/write this directory
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
      // Corrupted or tampered file — start fresh rather than crashing
      return { version: 1, notes: [] };
    }
  }

  private persist(store: NotesStore): void {
    const tmp = `${this.paths.file}.tmp`;
    // Atomic write: write to .tmp then rename so a crash never corrupts the store
    // mode 0o600: only the owning user can read/write
    writeFileSync(tmp, JSON.stringify(store, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(tmp, this.paths.file);
  }

  create(title: string, content: string, tags: string[]): Note {
    const store = this.load();
    if (store.notes.length >= MAX_NOTES) {
      throw new Error("Note limit reached (1,000 notes maximum)");
    }
    const now = new Date().toISOString();
    const note: Note = {
      id: uuidv4(), // UUID generated server-side — never from user input
      title,
      content,
      tags,
      createdAt: now,
      updatedAt: now,
    };
    store.notes.push(note);
    this.persist(store);
    return note;
  }

  update(id: string, updates: Partial<Pick<Note, "title" | "content" | "tags">>): Note | null {
    const store = this.load();
    const idx = store.notes.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    const existing = store.notes[idx];
    if (!existing) return null;

    // Only apply keys that were actually provided (never spread undefined)
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    ) as Partial<Pick<Note, "title" | "content" | "tags">>;

    const updated: Note = {
      ...existing,
      ...safeUpdates,
      id: existing.id, // id is immutable
      createdAt: existing.createdAt, // createdAt is immutable
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

  list(tag?: string): Note[] {
    const store = this.load();
    if (!tag) return store.notes;
    return store.notes.filter((n) => n.tags.includes(tag));
  }

  search(query: string): Note[] {
    const store = this.load();
    // escapeRegex prevents ReDoS from user-supplied search strings
    const pattern = new RegExp(escapeRegex(query), "i");
    return store.notes.filter((n) => pattern.test(n.title) || pattern.test(n.content));
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
