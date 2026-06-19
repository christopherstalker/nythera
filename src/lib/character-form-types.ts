export type CharacterVisibility = "PRIVATE" | "PUBLIC" | "UNLISTED";

export type CharacterFormValue = {
  id?: string;
  name: string;
  avatarUrl: string;
  description: string;
  personality: string;
  scenario: string;
  greeting: string;
  tags: string[];
  visibility: CharacterVisibility;
  isNSFW: boolean;
  personaRole: string;
  archetype: string;
  personaTraits: string;
  speakingStyle: string;
  emotionalTone: string;
  relationshipStyle: string;
  initiativeLevel: string;
  verbosityLevel: string;
  motivation: string;
  boundaries: string;
  behavioralRules: string;
  forbiddenBehaviors: string;
  tone: string;
  humor: number;
  romanceLevel: number;
  seriousness: number;
  initiative: number;
  messageLength: string;
  roleplayIntensity: number;
};

export type CharacterFormInitialValue = Omit<Partial<CharacterFormValue>, "tags"> & {
  communicationStyle?: Record<string, unknown> | null;
  persona?: Record<string, unknown> | null;
  tags?: string[] | string;
};

export type CharacterCreatePayload = {
  name: string;
  avatarUrl: string;
  description: string;
  personality: string;
  scenario: string;
  greeting: string;
  visibility: CharacterVisibility;
  isNSFW: boolean;
  tags: string[];
  persona?: Record<string, unknown>;
  communicationStyle?: Record<string, unknown>;
};

export type GeneratedCharacterPreview = {
  name?: string;
  description?: string;
  personality: string;
  scenario: string;
  greeting: string;
  tags: string[];
  isNSFW?: boolean;
  persona?: Record<string, unknown> | null;
  communicationStyle?: Record<string, unknown> | null;
};

export type PromptGenerationMeta = {
  source: "llm" | "heuristic";
  provider: {
    displayName: string;
    model: string;
  };
};

export const VIBE_PRESETS = [
  "Fantasy",
  "Romance",
  "Sci-Fi",
  "Mystery",
  "Cozy",
  "Dark",
  "Comedy",
  "Action",
  "Slice of Life",
  "Horror"
] as const;

export const CUSTOM_SECTION_IDS = ["basics", "personality", "scenario", "greeting", "speaking", "advanced"] as const;

export type CustomSectionId = (typeof CUSTOM_SECTION_IDS)[number];

export const CUSTOM_SECTIONS: ReadonlyArray<{
  id: CustomSectionId;
  title: string;
  description: string;
}> = [
  { id: "basics", title: "Basics", description: "Name, hook, avatar, and tags." },
  { id: "personality", title: "Personality & Persona", description: "Who they are and how they feel." },
  { id: "scenario", title: "Scenario & World", description: "Setting, lore, and world context." },
  { id: "greeting", title: "Greeting", description: "The first message users see when a chat begins." },
  { id: "speaking", title: "Speaking Style", description: "Voice, tone, and message shape." },
  { id: "advanced", title: "Advanced", description: "Boundaries, tuning, and publish settings." }
];

export const emptyCharacterDraft: CharacterFormValue = {
  name: "",
  avatarUrl: "",
  description: "",
  personality: "",
  scenario: "",
  greeting: "",
  tags: ["roleplay"],
  visibility: "PRIVATE",
  isNSFW: false,
  personaRole: "",
  archetype: "",
  personaTraits: "",
  speakingStyle: "",
  emotionalTone: "",
  relationshipStyle: "",
  initiativeLevel: "",
  verbosityLevel: "",
  motivation: "",
  boundaries: "",
  behavioralRules: "",
  forbiddenBehaviors: "",
  tone: "",
  humor: 5,
  romanceLevel: 0,
  seriousness: 5,
  initiative: 5,
  messageLength: "",
  roleplayIntensity: 5
};