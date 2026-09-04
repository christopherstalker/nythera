import { cn } from "@/lib/utils";
import { parseRichText, type RichTextInlineNode } from "@/lib/rich-text-formatting";

const FORMAT_CLASSES = {
  bold: "font-semibold text-foreground",
  italic: "italic text-foreground/95",
  boldItalic: "font-semibold italic text-foreground",
  underline: "underline decoration-primary/50 underline-offset-4 text-foreground",
  strike: "line-through decoration-current/55 text-muted-foreground",
  highlight: "rounded-md bg-primary/[0.14] px-1 font-medium text-foreground",
  subtext: "italic text-muted-foreground/80"
} as const;

export function RichMessageText({ text, className }: { text: string; className?: string }) {
  // Render-only parser: raw formatted text stays unchanged in storage, memory, and prompt assembly.
  // React text nodes keep this safe from HTML/script injection while preserving nested roleplay prose.
  const blocks = parseRichText(text);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {blocks.map((block, blockIndex) => (
        <span key={`block-${blockIndex}`}>
          <span
            className={cn(
              block.type === "quote" &&
                "my-1 block border-l-2 border-[var(--accent-purple)] bg-white/[0.025] py-1 pl-3 italic text-[var(--text-secondary)]"
            )}
          >
            {renderInlineNodes(block.children, `block-${blockIndex}`)}
          </span>
          {blockIndex < blocks.length - 1 ? "\n" : null}
        </span>
      ))}
    </span>
  );
}

function renderInlineNodes(nodes: RichTextInlineNode[], prefix: string): React.ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") return node.value;

    const key = `${prefix}-${node.format}-${index}`;
    return (
      <span key={key} className={FORMAT_CLASSES[node.format]}>
        {renderInlineNodes(node.children, key)}
      </span>
    );
  });
}
