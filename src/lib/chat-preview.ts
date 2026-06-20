export function toChatPreview(value: string, maxLength = 96) {
  const plain = value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?|```/g, ""))
    .replace(/[`*_~>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
