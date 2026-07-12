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

const richTextMarkSchema = z
  .object({
    type: z.enum(["bold", "italic", "underline", "strike", "code", "link"]),
    attrs: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((mark, context) => {
    if (mark.type !== "link") return;
    const href = mark.attrs?.href;
    if (
      typeof href !== "string" ||
      href.length > 2_048 ||
      !/^(https?:\/\/|mailto:)/i.test(href)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Links must use an HTTP, HTTPS, or mailto URL",
      });
    }
  });

export interface RichTextNode {
  type:
    | "paragraph"
    | "heading"
    | "blockquote"
    | "horizontalRule"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "codeBlock"
    | "text"
    | "hardBreak";
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  text?: string;
  marks?: Array<z.infer<typeof richTextMarkSchema>>;
}

export interface RichTextDocument {
  type: "doc";
  content: RichTextNode[];
}

const richTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z
    .object({
      type: z.enum([
        "paragraph",
        "heading",
        "blockquote",
        "horizontalRule",
        "bulletList",
        "orderedList",
        "listItem",
        "codeBlock",
        "text",
        "hardBreak",
      ]),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(richTextNodeSchema).max(1_000).optional(),
      text: z.string().max(100_000).optional(),
      marks: z.array(richTextMarkSchema).max(20).optional(),
    })
    .strict()
    .superRefine((node, context) => {
      if (node.type === "text") {
        if (node.text === undefined || node.content !== undefined) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "Text nodes require text only" });
        }
        return;
      }

      if (node.text !== undefined || node.marks !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Only text nodes may contain text or marks",
        });
      }

      if (node.type === "heading") {
        const level = node.attrs?.level;
        if (!Number.isInteger(level) || Number(level) < 1 || Number(level) > 4) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Heading level must be between 1 and 4",
          });
        }
      }

      if (node.type === "horizontalRule" || node.type === "hardBreak") {
        if (node.content !== undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${node.type} cannot contain child nodes`,
          });
        }
      } else if (
        node.content === undefined &&
        !["paragraph", "heading", "codeBlock"].includes(node.type)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${node.type} requires content`,
        });
      }
    }),
);

export const richTextDocumentSchema: z.ZodType<RichTextDocument> = z
  .object({
    type: z.literal("doc"),
    content: z.array(richTextNodeSchema).max(1_000),
  })
  .strict();

const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id: blockIdSchema,
    type: z.literal("text"),
    content: z.union([z.string().max(100_000), richTextDocumentSchema]),
  }),
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

export function createRichTextDocument(text = ""): RichTextDocument {
  const content: RichTextNode[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((line, index) => {
    if (line) content.push({ type: "text", text: line });
    if (index < lines.length - 1) content.push({ type: "hardBreak" });
  });
  return {
    type: "doc",
    content: [{ type: "paragraph", content }],
  };
}

export function normalizeRichTextContent(
  content: string | RichTextDocument,
): RichTextDocument {
  if (typeof content !== "string") return content;

  try {
    const parsed: unknown = JSON.parse(content);
    const result = richTextDocumentSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch {
    // Existing records are plain text, so a failed parse is the normal legacy path.
  }

  return createRichTextDocument(content);
}

export function serializeRichTextContent(document: RichTextDocument): string {
  return JSON.stringify(richTextDocumentSchema.parse(document));
}

export function isSerializedRichTextContent(value: string): boolean {
  try {
    return richTextDocumentSchema.safeParse(JSON.parse(value)).success;
  } catch {
    return false;
  }
}

export function richTextContentToPlainText(
  content: string | RichTextDocument,
): string {
  return richTextToPlainText(normalizeRichTextContent(content));
}

export function richTextToPlainText(document: RichTextDocument): string {
  const collect = (nodes: readonly RichTextNode[]): string =>
    nodes
      .map((node) => {
        if (node.type === "text") return node.text ?? "";
        if (node.type === "hardBreak") return "\n";
        if (node.type === "horizontalRule") return "\n";
        const nested = collect(node.content ?? []);
        return ["paragraph", "heading", "blockquote", "listItem", "codeBlock"].includes(node.type)
          ? `${nested}\n`
          : nested;
      })
      .join("");
  return collect(document.content).trim();
}

function richTextHasVisualContent(nodes: readonly RichTextNode[]): boolean {
  return nodes.some(
    (node) =>
      node.type === "horizontalRule" ||
      (node.type === "text" && Boolean(node.text?.trim())) ||
      richTextHasVisualContent(node.content ?? []),
  );
}

export function hasMeaningfulEnhancedContent(blocks: readonly ContentBlock[]): boolean {
  return blocks.some((block) => {
    if (block.type === "text") {
      return typeof block.content === "string"
        ? block.content.trim().length > 0
        : richTextHasVisualContent(block.content.content);
    }
    if (block.type === "image") {
      return Boolean(block.content.url.trim() || block.content.caption.trim());
    }
    return block.content.headers.some((header) => header.trim()) ||
      block.content.rows.some((row) => row.some((cell) => cell.trim()));
  });
}

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
      return { id, type, content: createRichTextDocument() };
    case "table":
      return { id, type, content: { headers: ["Column 1"], rows: [["Row 1"]] } };
    case "image":
      return { id, type, content: { url: "", alt: "", caption: "" } };
  }
}
