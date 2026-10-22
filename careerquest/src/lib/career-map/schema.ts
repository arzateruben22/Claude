import { z } from "zod";
import { CAREER_NODE_KEYS } from "./graph";
import { MARKABLE_STATUSES } from "./types";

export const MARK_NOTES_MAX = 500;

/** "Mark this stop yourself" form. */
export const markNodeSchema = z.object({
  nodeKey: z.enum(CAREER_NODE_KEYS, { message: "That stop is not on the map." }),
  status: z.enum(MARKABLE_STATUSES, { message: "Choose a status." }),
  notes: z
    .string()
    .trim()
    .max(MARK_NOTES_MAX, `Keep the note under ${MARK_NOTES_MAX} characters.`)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const clearMarkSchema = z.object({
  nodeKey: z.enum(CAREER_NODE_KEYS, { message: "That stop is not on the map." }),
});
