import assert from "node:assert/strict";
import test from "node:test";
import {
  createContentBlock,
  enhancedContentJsonSchema,
  parseEnhancedContent,
  serializeEnhancedContent,
} from "./enhanced-content";

test("enhanced content round-trips its discriminated blocks", () => {
  const blocks = [
    createContentBlock("text", "text-1"),
    createContentBlock("table", "table-1"),
    createContentBlock("image", "image-1"),
  ];
  assert.deepEqual(parseEnhancedContent(serializeEnhancedContent(blocks)), blocks);
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
