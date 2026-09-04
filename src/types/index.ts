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
  prologuePov?: "second" | "third";
};

export type CharacterPersonaMember = {
  id?: string;
  name: string;
  personality?: string;
  role?: string;
  archetype?: string;
  personalityTraits?: string[];
  speakingStyle?: string;
  emotionalTone?: string;
  initiativeLevel?: "low" | "medium" | "high";
  verbosityLevel?: "concise" | "balanced" | "expressive" | "immersive";
  relationshipStyle?: "friend" | "romantic" | "mentor" | "rival" | "antagonist";
  relationshipDynamics?: "friend" | "romantic" | "mentor" | "rival" | "antagonist";
  motivation?: string;
  behavioralRules?: string[];
  forbiddenBehaviors?: string[];
  boundaries?: string[];
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
  additionalCharacters?: CharacterPersonaMember[];
};

export type PublicCharacterProfile = {
  id: string;
  creatorId: string;
  name: string;
  avatarUrl?: string | null;
  description: string;
  personality: string;
  scenario?: string | null;
  greeting: string;
  tags: string[];
  likes: number;
  ratingAverage: number;
  ratingCount: number;
  isNSFW?: boolean;
  visibility?: string;
  originType?: "ORIGINAL" | "PUBLIC_DOMAIN" | "LICENSED" | "FAN_INTERPRETATION" | "REAL_PERSON" | "HISTORICAL_FIGURE";
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  isRealPerson?: boolean;
  aiDisclosure?: boolean;
  communicationStyle?: Record<string, unknown> | null;
  persona?: CharacterPersona | null;
  lorebook?: { entries?: Array<{ id?: string; keywords?: string[]; text?: string }> } | null;
  visualIdentity?: {
    accentColor?: string;
    gradientFrom?: string;
    gradientTo?: string;
    chatBackground?: string;
  } | null;
  creator?: {
    username?: string | null;
  } | null;
};

export type PromptMessage = {
  role: ChatRole;
  content: string;
  images?: PromptImage[];
};

export type PromptImage = {
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
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
  pinned?: boolean;
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
