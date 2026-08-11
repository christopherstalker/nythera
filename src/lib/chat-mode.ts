export type ChatMode = "realism" | "fantasy";

export const CHAT_MODES = [
  {
    id: "realism" as const,
    label: "Realism",
    icon: "🎭",
    description: "Natural, authentic conversations",
    color: "#4ade80"
  },
  {
    id: "fantasy" as const,
    label: "Fantasy",
    icon: "✨",
    description: "Creative, dramatic, immersive",
    color: "#a78bfa"
  }
];

export function normalizeChatMode(value?: string | null): ChatMode {
  return value === "fantasy" ? "fantasy" : "realism";
}

export const CHAT_MODE_STORAGE_KEY = "nythera:chat-mode";
