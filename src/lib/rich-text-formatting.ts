export const RICH_TEXT_FORMATS = [
  {
    id: "bold",
    label: "Bold",
    shortLabel: "B",
    start: "**",
    end: "**",
    syntax: "**bold**",
    example: "A decisive detail",
    description: "Give a word or sentence strong emphasis.",
    shortcut: "Mod+B"
  },
  {
    id: "italic",
    label: "Italic",
    shortLabel: "I",
    start: "*",
    end: "*",
    syntax: "*italic*",
    example: "A quiet action",
    description: "Use for actions, thoughts, or softer emphasis.",
    shortcut: "Mod+I"
  },
  {
    id: "boldItalic",
    label: "Bold italic",
    shortLabel: "BI",
    start: "***",
    end: "***",
    syntax: "***bold italic***",
    example: "A pivotal action",
    description: "Combine strong and expressive emphasis."
  },
  {
    id: "underline",
    label: "Underline",
    shortLabel: "U",
    start: "__",
    end: "__",
    syntax: "__underline__",
    example: "An important clue",
    description: "Mark a detail the reader should not miss.",
    shortcut: "Mod+U"
  },
  {
    id: "strike",
    label: "Strikethrough",
    shortLabel: "S",
    start: "~~",
    end: "~~",
    syntax: "~~strikethrough~~",
    example: "A corrected thought",
    description: "Show a discarded word or interrupted thought."
  },
  {
    id: "highlight",
    label: "Highlight",
    shortLabel: "H",
    start: "==",
    end: "==",
    syntax: "==highlight==",
    example: "The key revelation",
    description: "Add a restrained highlight behind important text."
  },
  {
    id: "subtext",
    label: "Subtext",
    shortLabel: "( )",
    start: "(",
    end: ")",
    syntax: "(subtext)",
    example: "almost too quietly to hear",
    description: "Render a muted aside without showing the parentheses."
  },
  {
    id: "quote",
    label: "Quote",
    shortLabel: ">",
    start: "> ",
    end: "",
    syntax: "> quoted line",
    example: "The archive remembers everything.",
    description: "Set one or more lines apart as dialogue or a quotation."
  }
] as const;

export type RichTextFormat = (typeof RICH_TEXT_FORMATS)[number]["id"];

export type RichTextInlineNode =
  | { type: "text"; value: string }
  | { type: "format"; format: Exclude<RichTextFormat, "quote">; children: RichTextInlineNode[] };

export type RichTextBlock = {
  type: "line" | "quote";
  children: RichTextInlineNode[];
};

const INLINE_RULES = RICH_TEXT_FORMATS
  .filter((format) => format.id !== "quote")
  .sort((left, right) => right.start.length - left.start.length) as Array<
  Exclude<(typeof RICH_TEXT_FORMATS)[number], { id: "quote" }>
>;

export function parseRichText(value: string): RichTextBlock[] {
  if (hasMultilineOuterFormat(value)) {
    return [{ type: "line", children: parseInlineRichText(value) }];
  }

  return value.split("\n").map((line) => {
    const quoteMatch = line.match(/^(\s*)>\s?/);
    const content = quoteMatch ? line.slice(quoteMatch[0].length) : line;

    return {
      type: quoteMatch ? "quote" : "line",
      children: parseInlineRichText(content)
    };
  });
}

function hasMultilineOuterFormat(value: string) {
  if (!value.includes("\n")) return false;

  const trimmed = value.trim();
  return ["***", "**", "*", "__", "~~", "=="].some((marker) =>
    trimmed.startsWith(marker) &&
    trimmed.endsWith(marker) &&
    trimmed.length > marker.length * 2
  );
}

export function parseInlineRichText(value: string): RichTextInlineNode[] {
  return parseSequence(value, 0).nodes;
}

export function richTextToPlainText(value: string) {
  return parseRichText(value)
    .map((block) => inlineNodesToText(block.children))
    .join("\n");
}

export function applyRichTextFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  formatId: RichTextFormat
) {
  const format = RICH_TEXT_FORMATS.find((item) => item.id === formatId);

  if (!format) {
    return { value, selectionStart, selectionEnd };
  }

  if (format.id === "quote") {
    return toggleQuote(value, selectionStart, selectionEnd);
  }

  const selected = value.slice(selectionStart, selectionEnd);
  const isWrapped =
    selectionStart >= format.start.length &&
    value.slice(selectionStart - format.start.length, selectionStart) === format.start &&
    value.slice(selectionEnd, selectionEnd + format.end.length) === format.end;

  if (isWrapped) {
    const nextValue =
      value.slice(0, selectionStart - format.start.length) +
      selected +
      value.slice(selectionEnd + format.end.length);

    return {
      value: nextValue,
      selectionStart: selectionStart - format.start.length,
      selectionEnd: selectionEnd - format.start.length
    };
  }

  const nextValue =
    value.slice(0, selectionStart) +
    format.start +
    selected +
    format.end +
    value.slice(selectionEnd);

  return {
    value: nextValue,
    selectionStart: selectionStart + format.start.length,
    selectionEnd: selectionEnd + format.start.length
  };
}

export function richTextFormatFromShortcut(key: string, modifierPressed: boolean): RichTextFormat | null {
  if (!modifierPressed) return null;

  switch (key.toLowerCase()) {
    case "b":
      return "bold";
    case "i":
      return "italic";
    case "u":
      return "underline";
    default:
      return null;
  }
}

function parseSequence(value: string, startIndex: number, closingMarker?: string): {
  nodes: RichTextInlineNode[];
  index: number;
  closed: boolean;
} {
  const nodes: RichTextInlineNode[] = [];
  let textBuffer = "";
  let index = startIndex;

  const flushText = () => {
    if (!textBuffer) return;
    nodes.push({ type: "text", value: textBuffer });
    textBuffer = "";
  };

  while (index < value.length) {
    if (closingMarker && markerMatches(value, index, closingMarker)) {
      flushText();
      return { nodes, index: index + closingMarker.length, closed: true };
    }

    if (value[index] === "\\" && index + 1 < value.length && isEscapable(value[index + 1])) {
      textBuffer += value[index + 1];
      index += 2;
      continue;
    }

    const rule = INLINE_RULES.find((candidate) => markerMatches(value, index, candidate.start));

    if (rule) {
      const nested = parseSequence(value, index + rule.start.length, rule.end);

      if (nested.closed && nested.index > index + rule.start.length + rule.end.length) {
        flushText();
        nodes.push({ type: "format", format: rule.id, children: nested.nodes });
        index = nested.index;
        continue;
      }
    }

    textBuffer += value[index];
    index += 1;
  }

  flushText();
  return { nodes, index, closed: !closingMarker };
}

function markerMatches(value: string, index: number, marker: string) {
  if (!value.startsWith(marker, index)) return false;

  if (marker.length > 0 && marker.split("").every((character) => character === marker[0])) {
    const character = marker[0];
    let runLength = 0;
    let cursor = index;

    while (value[cursor] === character) {
      runLength += 1;
      cursor += 1;
    }

    return runLength === marker.length;
  }

  return true;
}

function inlineNodesToText(nodes: RichTextInlineNode[]): string {
  return nodes
    .map((node) => (node.type === "text" ? node.value : inlineNodesToText(node.children)))
    .join("");
}

function isEscapable(character: string) {
  return ["\\", "*", "_", "~", "=", "(", ")", ">"].includes(character);
}

function toggleQuote(value: string, selectionStart: number, selectionEnd: number) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const lineEndSearch = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndSearch === -1 ? value.length : lineEndSearch;
  const selectedLines = value.slice(lineStart, lineEnd);
  const lines = selectedLines.split("\n");
  const allQuoted = lines.every((line) => /^\s*>\s?/.test(line));
  const transformed = lines
    .map((line) => (allQuoted ? line.replace(/^(\s*)>\s?/, "$1") : `> ${line}`))
    .join("\n");
  const nextValue = value.slice(0, lineStart) + transformed + value.slice(lineEnd);
  const delta = transformed.length - selectedLines.length;

  return {
    value: nextValue,
    selectionStart: Math.max(lineStart, selectionStart + (allQuoted ? -2 : 2)),
    selectionEnd: Math.max(lineStart, selectionEnd + delta)
  };
}
