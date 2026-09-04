import { richTextToPlainText } from "@/lib/rich-text-formatting";

export function toChatPreview(value: string, maxLength = 96) {
  const normalized = value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?|```/g, ""));
  const plain = richTextToPlainText(normalized)
    .replace(/[`#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
