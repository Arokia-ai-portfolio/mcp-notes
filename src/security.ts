import { ZodError } from "zod";

/**
 * Escapes all special regex characters to prevent ReDoS attacks
 * when user-supplied strings are used in RegExp constructors.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns a safe error message that never leaks file paths,
 * stack traces, or internal implementation details.
 */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof ZodError) {
    return `Invalid input: ${err.errors.map((e) => e.message).join(", ")}`;
  }
  if (err instanceof Error) {
    // Only expose errno codes (e.g. EACCES, ENOSPC) — never the path
    const code = (err as NodeJS.ErrnoException).code;
    if (code) return `Storage error (${code})`;
    // Safe application-level messages we explicitly throw
    if (err.message.startsWith("Note limit")) return err.message;
  }
  return "An unexpected error occurred";
}
