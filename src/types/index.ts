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
  archetype?: string;
  personalityTraits?: string[];
  speakingStyle?: string;
  emotionalTone?: string;
  initiativeLevel?: "low" | "medium" | "high";
  boundaries?: string[];
  motivation?: string;
  behavioralRules?: string[];
  forbiddenBehaviors?: string[];
  verbosityLevel?: "concise" | "balanced" | "expressive" | "immersive";
  relationshipStyle?: "friend" | "romantic" | "mentor" | "rival" | "antagonist";
  relationshipDynamics?: "friend" | "romantic" | "mentor" | "rival" | "antagonist";
};

export type PromptMessage = {
  role: ChatRole;
  content: string;
};

export type ModelSamplingSettings = {
  temperature: number;
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  maxTokens?: number | null;
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
  | {
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      model: string;
      provider: string;
      usageEstimated: boolean;
      latencyMs?: number;
      fallbackTriggered?: boolean;
      attempts?: string[];
    }
  | { type: "error"; message: string }
  | { type: "done" };
