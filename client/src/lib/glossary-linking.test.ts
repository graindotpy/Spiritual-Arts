import assert from "node:assert/strict";
import test from "node:test";
import type { JSONContent } from "@tiptap/core";
import type { RichTextDocument } from "@shared/enhanced-content";
import {
  GLOSSARY_REFERENCE_MARK,
  decorateRichTextWithGlossaryReferences,
  findGlossaryMatches,
} from "./glossary-linking";

const referenceMark = (termId: string) => ({
  type: GLOSSARY_REFERENCE_MARK,
  attrs: { termId },
});

test("matches whole terms case-insensitively and treats punctuation as literal text", () => {
  const terms = [
    { id: "cpp", keyword: "C++", definition: "A language" },
    { id: "bracket", keyword: "[Burn]", definition: "A condition" },
    { id: "dot", keyword: "a.b", definition: "A dotted term" },
  ];
  const text = "Use c++ with [BURN] and A.B; avoid SC++Builder or xa.by.";

  const matches = findGlossaryMatches(text, terms);

  assert.deepEqual(
    matches.map(({ start, end, term }) => ({ value: text.slice(start, end), term })),
    [
      { value: "c++", term: terms[0] },
      { value: "[BURN]", term: terms[1] },
      { value: "A.B", term: terms[2] },
    ],
  );
  assert.strictEqual(matches[0].term, terms[0]);
});

test("excludes substrings and gives the longest overlapping keyword precedence", () => {
  const terms = [
    { id: "demon", keyword: "Demon" },
    { id: "stance", keyword: "Demon Stance" },
    { id: "cat", keyword: "cat" },
  ];
  const text = "Demon Stance faces a cat, not a concatenated catalog.";

  assert.deepEqual(
    findGlossaryMatches(text, terms).map(({ start, end, term }) => ({
      value: text.slice(start, end),
      id: term.id,
    })),
    [
      { value: "Demon Stance", id: "stance" },
      { value: "cat", id: "cat" },
    ],
  );
});

test("decorates a term across differently formatted adjacent text nodes", () => {
  const document: RichTextDocument = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { alignment: "left" },
        content: [
          { type: "text", text: "A Grung ", marks: [{ type: "bold" }] },
          { type: "text", text: "Toxin effect", marks: [{ type: "italic" }] },
        ],
      },
    ],
  };
  const original = structuredClone(document);

  const decorated = decorateRichTextWithGlossaryReferences(document, [
    { id: "toxin", keyword: "Grung Toxin" },
  ]);

  assert.deepEqual(document, original);
  assert.notStrictEqual(decorated, document);
  assert.notStrictEqual(decorated.content, document.content);
  assert.deepEqual(decorated, {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { alignment: "left" },
        content: [
          { type: "text", text: "A ", marks: [{ type: "bold" }] },
          {
            type: "text",
            text: "Grung ",
            marks: [{ type: "bold" }, referenceMark("toxin")],
          },
          {
            type: "text",
            text: "Toxin",
            marks: [{ type: "italic" }, referenceMark("toxin")],
          },
          { type: "text", text: " effect", marks: [{ type: "italic" }] },
        ],
      },
    ],
  });
});

test("does not match across a hard break", () => {
  const document: JSONContent = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Grung " },
          { type: "hardBreak" },
          { type: "text", text: "Toxin" },
        ],
      },
    ],
  };

  assert.deepEqual(
    decorateRichTextWithGlossaryReferences(document, [
      { id: "toxin", keyword: "Grung Toxin" },
    ]),
    document,
  );
});

test("skips a whole match when any of it overlaps a link or inline-code mark", () => {
  const document: JSONContent = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Linked Grung " },
          {
            type: "text",
            text: "Toxin",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
          { type: "text", text: "; coded " },
          { type: "text", text: "Grung Toxin", marks: [{ type: "code" }] },
          { type: "text", text: "; clean Grung Toxin." },
        ],
      },
    ],
  };

  const decorated = decorateRichTextWithGlossaryReferences(document, [
    { id: "toxin", keyword: "Grung Toxin" },
  ]);
  const textNodes = decorated.content?.[0].content ?? [];
  const referencedText = textNodes
    .filter((node) => node.marks?.some((mark) => mark.type === GLOSSARY_REFERENCE_MARK))
    .map((node) => node.text)
    .join("");

  assert.equal(referencedText, "Grung Toxin");
  assert.equal(
    textNodes.filter((node) =>
      node.marks?.some((mark) => mark.type === GLOSSARY_REFERENCE_MARK),
    ).length,
    1,
  );
  assert.deepEqual(document.content?.[0].content?.[1].marks, [
    { type: "link", attrs: { href: "https://example.com" } },
  ]);
});

test("does not decorate code blocks and replaces stale transient marks immutably", () => {
  const document: JSONContent = {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        content: [{ type: "text", text: "Grung Toxin" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Grung Toxin",
            marks: [referenceMark("stale")],
          },
        ],
      },
    ],
  };
  const original = structuredClone(document);

  const decorated = decorateRichTextWithGlossaryReferences(document, [
    { id: "current", keyword: "Grung Toxin" },
  ]);

  assert.deepEqual(document, original);
  assert.equal(decorated.content?.[0].content?.[0].marks, undefined);
  assert.deepEqual(decorated.content?.[1].content?.[0].marks, [referenceMark("current")]);
});
