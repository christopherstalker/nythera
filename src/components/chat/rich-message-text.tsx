import { cn } from "@/lib/utils";

type TokenPattern = {
  start: string;
  end: string;
  className: string;
  keepDelimiters?: boolean;
};

const patterns: TokenPattern[] = [
  { start: "***", end: "***", className: "font-semibold italic text-foreground" },
  { start: "**", end: "**", className: "font-semibold text-foreground" },
  { start: "==", end: "==", className: "rounded-md bg-primary/[0.14] px-1 font-medium text-foreground" },
  { start: "__", end: "__", className: "underline decoration-primary/50 underline-offset-4 text-foreground" },
  { start: "~~", end: "~~", className: "text-muted-foreground/75" },
  { start: "*", end: "*", className: "italic text-foreground/95" },
  { start: "(", end: ")", className: "italic text-muted-foreground/80", keepDelimiters: true }
];

export function RichMessageText({ text, className }: { text: string; className?: string }) {
  return <span className={cn("whitespace-pre-wrap", className)}>{renderTokens(text)}</span>;
}

function renderTokens(text: string, depth = 0, prefix = "t"): React.ReactNode[] {
  if (depth > 8 || !text) {
    return [text];
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  while (cursor < text.length) {
    const match = findNextToken(text, cursor);

    if (!match) {
      nodes.push(text.slice(cursor));
      break;
    }

    if (match.startIndex > cursor) {
      nodes.push(text.slice(cursor, match.startIndex));
    }

    const innerStart = match.startIndex + match.pattern.start.length;
    const inner = text.slice(innerStart, match.endIndex);
    const key = `${prefix}-${depth}-${tokenIndex}`;

    nodes.push(
      <span key={key} className={match.pattern.className}>
        {match.pattern.keepDelimiters ? match.pattern.start : null}
        {renderTokens(inner, depth + 1, key)}
        {match.pattern.keepDelimiters ? match.pattern.end : null}
      </span>
    );

    cursor = match.endIndex + match.pattern.end.length;
    tokenIndex += 1;
  }

  return nodes;
}

function findNextToken(text: string, fromIndex: number) {
  let best:
    | {
        pattern: TokenPattern;
        startIndex: number;
        endIndex: number;
      }
    | null = null;

  for (const pattern of patterns) {
    const startIndex = text.indexOf(pattern.start, fromIndex);

    if (startIndex < 0) {
      continue;
    }

    const endIndex = text.indexOf(pattern.end, startIndex + pattern.start.length);

    if (endIndex < 0) {
      continue;
    }

    if (
      !best ||
      startIndex < best.startIndex ||
      (startIndex === best.startIndex && pattern.start.length > best.pattern.start.length)
    ) {
      best = { pattern, startIndex, endIndex };
    }
  }

  return best;
}
