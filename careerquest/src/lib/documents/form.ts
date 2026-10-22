/** zod schemas for the document server actions (kept out of the "use server" file). Pure. */
import { z } from "zod";
import { DocumentKind } from "@/generated/prisma/enums";

export const uploadDocumentSchema = z.object({
  kind: z.enum(DocumentKind, { error: "Choose what kind of document this is." }),
});

export const documentIdSchema = z.object({ id: z.uuid("Unknown document.") });

export type UploadedDocumentInfo = { id: string; fileName: string; kind: DocumentKind };
