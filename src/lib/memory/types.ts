import type { MemoryCategory } from "@prisma/client";

export type MemoryTier = "session" | "character" | "user";

export type ExtractedMemory = {
  text: string;
  tier: "character" | "user";
  category: "preference" | "identity" | "style" | "avoid" | "relationship";
};

export type TieredMemoryView = {
  character: Array<{ text: string; category: MemoryCategory }>;
  user: Array<{ text: string; category: MemoryCategory; metadata?: unknown }>;
};
