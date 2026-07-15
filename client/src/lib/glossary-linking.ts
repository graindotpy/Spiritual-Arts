import type { JSONContent } from "@tiptap/core";
import type { RichTextDocument } from "@shared/enhanced-content";

export const GLOSSARY_REFERENCE_MARK = "glossaryReference";

export interface GlossaryLinkTerm {
  id: string;
  keyword: string;
}

export interface GlossaryMatch<T extends GlossaryLinkTerm> {
  start: number;
  end: number;
  term: T;
}

interface MatchCandidate<T extends GlossaryLinkTerm> extends GlossaryMatch<T> {
  termOrder: number;
}

const WORD_CHARACTER = /[\p{L}\p{M}\p{N}_]/u;
const PROTECTED_MARKS = new Set(["link", "code"]);

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function characterBefore(value: string, index: number): string | undefined {
  if (index <= 0) return undefined;

  let characterIndex = index - 1;
  const trailingCodeUnit = value.charCodeAt(characterIndex);
  if (
    trailingCodeUnit >= 0xdc00 &&
    trailingCodeUnit <= 0xdfff &&
    characterIndex > 0
  ) {
    const leadingCodeUnit = value.charCodeAt(characterIndex - 1);
    if (leadingCodeUnit >= 0xd800 && leadingCodeUnit <= 0xdbff) {
      characterIndex -= 1;
    }
  }

  const codePoint = value.codePointAt(characterIndex);
  return codePoint === undefined ? undefined : String.fromCodePoint(codePoint);
}

function characterAt(value: string, index: number): string | undefined {
  const codePoint = value.codePointAt(index);
  return codePoint === undefined ? undefined : String.fromCodePoint(codePoint);
}

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && WORD_CHARACTER.test(value);
}

function hasWholeTermBoundaries(text: string, start: number, end: number): boolean {
  return (
    !isWordCharacter(characterBefore(text, start)) &&
    !isWordCharacter(characterAt(text, end))
  );
}

function collectGlossaryMatchCandidates<T extends GlossaryLinkTerm>(
  text: string,
  terms: readonly T[],
): MatchCandidate<T>[] {
  const candidates: MatchCandidate<T>[] = [];

  terms.forEach((term, termOrder) => {
    if (!term.keyword) return;

    const pattern = new RegExp(escapeRegularExpression(term.keyword), "giu");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (hasWholeTermBoundaries(text, start, end)) {
        candidates.push({ start, end, term, termOrder });
      }
    }
  });

  return candidates;
}

function rangesOverlap(
  first: Pick<GlossaryMatch<GlossaryLinkTerm>, "start" | "end">,
  second: Pick<GlossaryMatch<GlossaryLinkTerm>, "start" | "end">,
): boolean {
  return first.start < second.end && second.start < first.end;
}

function resolveGlossaryMatchCandidates<T extends GlossaryLinkTerm>(
  candidates: readonly MatchCandidate<T>[],
): GlossaryMatch<T>[] {
  const selected: MatchCandidate<T>[] = [];
  const longestFirst = [...candidates].sort((left, right) =>
    (right.end - right.start) - (left.end - left.start) ||
    left.start - right.start ||
    left.termOrder - right.termOrder,
  );

  for (const candidate of longestFirst) {
    if (selected.some((match) => rangesOverlap(candidate, match))) continue;
    selected.push(candidate);
  }

  return selected
    .sort((left, right) => left.start - right.start)
    .map(({ start, end, term }) => ({ start, end, term }));
}

/**
 * Finds non-overlapping, whole-term glossary references in display order.
 * When glossary keywords overlap, the longest keyword takes precedence.
 */
export function findGlossaryMatches<T extends GlossaryLinkTerm>(
  text: string,
  terms: readonly T[],
): GlossaryMatch<T>[] {
  return resolveGlossaryMatchCandidates(collectGlossaryMatchCandidates(text, terms));
}

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)]),
    ) as T;
  }
  return value;
}

function removeTransientReferenceMarks(node: JSONContent): void {
  if (!node.marks) return;
  const persistentMarks = node.marks.filter((mark) => mark.type !== GLOSSARY_REFERENCE_MARK);
  if (persistentMarks.length > 0) {
    node.marks = persistentMarks;
  } else {
    delete node.marks;
  }
}

function isProtectedTextNode(node: JSONContent): boolean {
  return node.marks?.some((mark) => PROTECTED_MARKS.has(mark.type)) ?? false;
}

function decorateTextRun<T extends GlossaryLinkTerm>(
  nodes: readonly JSONContent[],
  terms: readonly T[],
): JSONContent[] {
  const offsets: Array<{ start: number; end: number; node: JSONContent }> = [];
  let text = "";

  for (const node of nodes) {
    const start = text.length;
    text += node.text ?? "";
    offsets.push({ start, end: text.length, node });
  }

  const protectedRanges = offsets
    .filter(({ node }) => isProtectedTextNode(node))
    .map(({ start, end }) => ({ start, end }));
  const allowedCandidates = collectGlossaryMatchCandidates(text, terms).filter(
    (candidate) => !protectedRanges.some((range) => rangesOverlap(candidate, range)),
  );
  const matches = resolveGlossaryMatchCandidates(allowedCandidates);

  return offsets.flatMap(({ start: nodeStart, end: nodeEnd, node }) => {
    if (nodeStart === nodeEnd) {
      const emptyNode = cloneJsonValue(node);
      removeTransientReferenceMarks(emptyNode);
      return [emptyNode];
    }

    const boundaries = new Set([nodeStart, nodeEnd]);
    for (const match of matches) {
      if (match.start > nodeStart && match.start < nodeEnd) boundaries.add(match.start);
      if (match.end > nodeStart && match.end < nodeEnd) boundaries.add(match.end);
    }

    const orderedBoundaries = [...boundaries].sort((left, right) => left - right);
    const pieces: JSONContent[] = [];
    for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
      const pieceStart = orderedBoundaries[index];
      const pieceEnd = orderedBoundaries[index + 1];
      const piece = cloneJsonValue(node);
      piece.text = (node.text ?? "").slice(pieceStart - nodeStart, pieceEnd - nodeStart);
      removeTransientReferenceMarks(piece);

      const reference = matches.find(
        (match) => match.start <= pieceStart && match.end >= pieceEnd,
      );
      if (reference) {
        piece.marks = [
          ...(piece.marks ?? []),
          {
            type: GLOSSARY_REFERENCE_MARK,
            attrs: { termId: reference.term.id },
          },
        ];
      }
      pieces.push(piece);
    }

    return pieces;
  });
}

function decorateContent<T extends GlossaryLinkTerm>(
  content: readonly JSONContent[],
  terms: readonly T[],
  decorationDisabled: boolean,
): JSONContent[] {
  const decorated: JSONContent[] = [];

  for (let index = 0; index < content.length;) {
    const node = content[index];
    if (!decorationDisabled && node.type === "text") {
      const textRun: JSONContent[] = [];
      while (index < content.length && content[index].type === "text") {
        textRun.push(content[index]);
        index += 1;
      }
      decorated.push(...decorateTextRun(textRun, terms));
      continue;
    }

    decorated.push(decorateNode(node, terms, decorationDisabled));
    index += 1;
  }

  return decorated;
}

function decorateNode<T extends GlossaryLinkTerm>(
  node: JSONContent,
  terms: readonly T[],
  decorationDisabled = false,
): JSONContent {
  const clone = cloneJsonValue(node);
  removeTransientReferenceMarks(clone);
  if (node.content) {
    clone.content = decorateContent(
      node.content,
      terms,
      decorationDisabled || node.type === "codeBlock",
    );
  }
  return clone;
}

/**
 * Adds transient glossary-reference marks without changing the persisted rich-text document.
 */
export function decorateRichTextWithGlossaryReferences<T extends GlossaryLinkTerm>(
  document: RichTextDocument | JSONContent,
  terms: readonly T[],
): JSONContent {
  return decorateNode(document, terms);
}
