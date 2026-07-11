import { z } from "zod";

const blockIdSchema = z.string().min(1).max(100);

const tableDataSchema = z.object({
  headers: z.array(z.string().max(1_000)).max(20),
  rows: z.array(z.array(z.string().max(10_000)).max(20)).max(200),
});

const imageDataSchema = z.object({
  url: z.string().max(2_048),
  alt: z.string().max(1_000),
  caption: z.string().max(2_000),
});

const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: blockIdSchema, type: z.literal("text"), content: z.string().max(100_000) }),
  z.object({ id: blockIdSchema, type: z.literal("table"), content: tableDataSchema }),
  z.object({ id: blockIdSchema, type: z.literal("image"), content: imageDataSchema }),
]);

const enhancedContentSchema = z.object({
  blocks: z.array(contentBlockSchema).max(200),
});

export const enhancedContentJsonSchema = z
  .string()
  .max(1_000_000)
  .refine((value) => {
    try {
      return enhancedContentSchema.safeParse(JSON.parse(value)).success;
    } catch {
      return false;
    }
  }, "Enhanced content must be valid structured JSON");

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ContentBlockType = ContentBlock["type"];

export function parseEnhancedContent(value: string | null | undefined): ContentBlock[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    const result = enhancedContentSchema.safeParse(parsed);
    return result.success ? result.data.blocks : [];
  } catch {
    return [];
  }
}

export function serializeEnhancedContent(blocks: readonly ContentBlock[]): string {
  return JSON.stringify(enhancedContentSchema.parse({ blocks }));
}

export function createContentBlock(
  type: ContentBlockType,
  id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
): ContentBlock {
  switch (type) {
    case "text":
      return { id, type, content: "" };
    case "table":
      return { id, type, content: { headers: ["Column 1"], rows: [["Row 1"]] } };
    case "image":
      return { id, type, content: { url: "", alt: "", caption: "" } };
  }
}
