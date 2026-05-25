import { z } from "zod";

// Only allow safe tag characters — prevents injection via tag values
const tagSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9\-_]*$/, "Tags must be alphanumeric with hyphens/underscores only");

export const SaveNoteInputSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 chars or fewer"),
  content: z.string().min(1, "Content is required").max(10_000, "Content must be 10,000 chars or fewer"),
  tags: z.array(tagSchema).max(10, "Maximum 10 tags allowed").optional().default([]),
});

export const UpdateNoteInputSchema = z
  .object({
    id: z.string().uuid("Invalid note ID — must be a UUID"),
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(10_000).optional(),
    tags: z.array(tagSchema).max(10).optional(),
  })
  .refine(
    (v) => v.title !== undefined || v.content !== undefined || v.tags !== undefined,
    "Provide at least one field to update"
  );

export const GetNoteInputSchema = z.object({
  id: z.string().uuid("Invalid note ID — must be a UUID"),
});

export const ListNotesInputSchema = z.object({
  tag: tagSchema.optional(),
});

export const SearchNotesInputSchema = z.object({
  query: z.string().min(1, "Query is required").max(200, "Query must be 200 chars or fewer"),
});

export const DeleteNoteInputSchema = z.object({
  id: z.string().uuid("Invalid note ID — must be a UUID"),
});

export type SaveNoteInput = z.infer<typeof SaveNoteInputSchema>;
export type UpdateNoteInput = z.infer<typeof UpdateNoteInputSchema>;
export type GetNoteInput = z.infer<typeof GetNoteInputSchema>;
export type ListNotesInput = z.infer<typeof ListNotesInputSchema>;
export type SearchNotesInput = z.infer<typeof SearchNotesInputSchema>;
export type DeleteNoteInput = z.infer<typeof DeleteNoteInputSchema>;
