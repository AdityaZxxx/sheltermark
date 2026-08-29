import { z } from "zod";

export const previewDocumentKindSchema = z.enum(["extract", "proxy"]);
export type PreviewDocumentKind = z.infer<typeof previewDocumentKindSchema>;
