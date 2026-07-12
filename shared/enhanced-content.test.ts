import assert from "node:assert/strict";
import test from "node:test";
import {
  createContentBlock,
  createRichTextDocument,
  enhancedContentJsonSchema,
  hasMeaningfulEnhancedContent,
  normalizeRichTextContent,
  parseEnhancedContent,
  richTextContentToPlainText,
  serializeEnhancedContent,
  serializeRichTextContent,
} from "./enhanced-content";

test("enhanced content round-trips its discriminated blocks", () => {
  const blocks = [
    createContentBlock("text", "text-1"),
    createContentBlock("table", "table-1"),
    createContentBlock("image", "image-1"),
  ];
  assert.deepEqual(parseEnhancedContent(serializeEnhancedContent(blocks)), blocks);
});

test("new content blocks still receive IDs when crypto.randomUUID is unavailable", () => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");

  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    const block = createContentBlock("text");
    assert.ok(block.id.length > 0);
    assert.equal(block.type, "text");
  } finally {
    if (cryptoDescriptor) {
      Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "crypto");
    }
  }
});

test("serialized rich text restores while legacy plain text remains supported", () => {
  const document = createRichTextDocument("Technique text");
  const serialized = serializeRichTextContent(document);

  assert.deepEqual(normalizeRichTextContent(serialized), document);
  assert.equal(richTextContentToPlainText(serialized), "Technique text");
  assert.equal(richTextContentToPlainText("Legacy technique text"), "Legacy technique text");
});

test("malformed or structurally invalid persisted JSON is safely ignored", () => {
  assert.deepEqual(parseEnhancedContent("{"), []);
  assert.deepEqual(
    parseEnhancedContent(JSON.stringify({ blocks: [{ id: "x", type: "table", content: "bad" }] })),
    [],
  );
});

test("the API-facing JSON schema rejects malformed enhanced content", () => {
  assert.equal(enhancedContentJsonSchema.safeParse('{"blocks":[]}').success, true);
  assert.equal(enhancedContentJsonSchema.safeParse("not-json").success, false);
  assert.equal(
    enhancedContentJsonSchema.safeParse('{"blocks":[{"type":"unknown"}]}').success,
    false,
  );
});

test("legacy plain text blocks remain plain and normalize into paragraphs", () => {
  const persisted = JSON.stringify({
    blocks: [{ id: "legacy", type: "text", content: "# This stays plain\nSecond line" }],
  });
  const [block] = parseEnhancedContent(persisted);
  assert.equal(block?.type, "text");
  if (!block || block.type !== "text") return;
  assert.equal(block.content, "# This stays plain\nSecond line");
  assert.deepEqual(normalizeRichTextContent(block.content), {
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "# This stays plain" },
        { type: "hardBreak" },
        { type: "text", text: "Second line" },
      ],
    }],
  });
});

test("rich text accepts h1-h4, quotes, rules, lists, and text marks", () => {
  const richBlock = {
    id: "rich",
    type: "text" as const,
    content: {
      type: "doc" as const,
      content: [
        { type: "heading" as const, attrs: { level: 1 }, content: [{ type: "text" as const, text: "Title" }] },
        { type: "heading" as const, attrs: { level: 4 }, content: [{ type: "text" as const, text: "Detail", marks: [{ type: "link" as const, attrs: { href: "https://example.com", target: "_blank", rel: "noopener noreferrer", class: null } }] }] },
        { type: "blockquote" as const, content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: "Wisdom", marks: [{ type: "italic" as const }] }] }] },
        { type: "horizontalRule" as const },
        { type: "bulletList" as const, content: [{ type: "listItem" as const, content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: "Item", marks: [{ type: "bold" as const }] }] }] }] },
      ],
    },
  };
  const serialized = serializeEnhancedContent([richBlock]);
  assert.deepEqual(parseEnhancedContent(serialized), [richBlock]);
  assert.equal(hasMeaningfulEnhancedContent([richBlock]), true);
});

test("rich text rejects unsupported heading levels and detects empty documents", () => {
  const invalid = JSON.stringify({
    blocks: [{
      id: "bad-heading",
      type: "text",
      content: {
        type: "doc",
        content: [{ type: "heading", attrs: { level: 5 }, content: [{ type: "text", text: "No" }] }],
      },
    }],
  });
  assert.equal(enhancedContentJsonSchema.safeParse(invalid).success, false);
  const unsafeLink = JSON.stringify({
    blocks: [{
      id: "unsafe-link",
      type: "text",
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Bad", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }],
      },
    }],
  });
  assert.equal(enhancedContentJsonSchema.safeParse(unsafeLink).success, false);
  const empty = createContentBlock("text", "empty");
  assert.equal(hasMeaningfulEnhancedContent([empty]), false);
  const populated = { ...empty, content: createRichTextDocument("A note") };
  assert.equal(hasMeaningfulEnhancedContent([populated]), true);
});
