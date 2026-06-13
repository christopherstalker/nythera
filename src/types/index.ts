export type UserRole = "USER" | "MODERATOR" | "ADMIN";
export type Visibility = "PRIVATE" | "PUBLIC" | "UNLISTED";
export type ChatRole = "system" | "user" | "assistant";

export type CommunicationStyle = {
  tone?: string;
  humor?: number;
  romanceLevel?: number;
  seriousness?: number;
  initiative?: number;
  messageLength?: "short" | "medium" | "long";
  roleplayIntensity?: number;
};

export type CharacterPersona = {
  name?: string;
  role?: string;
  personalityTraits?: string[];
  speakingStyle?: string;
  emotionalTone?: string;
  boundaries?: string[];
  motivation?: string;
  behavioralRules?: string[];
  verbosityLevel?: "concise" | "balanced" | "expressive" | "immersive";
  relationshipStyle?: "friend" | "romantic" | "mentor" | "rival";
};

export type PromptMessage = {
  role: ChatRole;
  content: string;
};

export type RetrievedMemory = {
  id: string;
  content: string;
  importance: number;
  category: string;
  confidence?: number;
  metadata?: unknown;
  similarity?: number;
};

export type StreamChunk =
  | { type: "delta"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; model: string; provider: string }
  | { type: "error"; message: string }
  | { type: "done" };
