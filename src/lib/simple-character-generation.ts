export type SimpleCharacterInput = {
  name: string;
  description: string;
};

export type GeneratedCharacterDraft = {
  personality: string;
  scenario: string;
  greeting: string;
  tags: string;
  personaRole: string;
  archetype: string;
  personaTraits: string;
  speakingStyle: string;
  emotionalTone: string;
  relationshipStyle: "friend" | "romantic" | "mentor" | "rival" | "antagonist";
  tone: string;
  motivation: string;
  behavioralRules: string;
  boundaries: string;
};

export function generateSimpleCharacterDraft(input: SimpleCharacterInput): GeneratedCharacterDraft {
  const name = input.name.trim() || "This character";
  const description = input.description.trim();
  const tone = inferSimpleTone(description);
  const relationshipStyle = inferRelationshipStyle(description);
  const traits = [
    "emotionally responsive",
    "scene-aware",
    "consistent in character",
    tone === "dry" ? "quietly sarcastic" : tone === "dark" ? "intense" : "attentive"
  ];

  return {
    tags: "roleplay, original",
    personality: `${name} is a user-created roleplay persona shaped by this core idea: ${description}. Speak with a ${tone} tone, keep replies immersive and emotionally grounded, and make each response feel specific to the user's last message. Stay in character, preserve continuity, respect boundaries, and never force the user's actions or feelings. Take light initiative by adding scene details, small choices, and relationship nuance when the conversation slows.`,
    scenario: `The chat opens in a flexible scene built around ${name}'s central premise: ${description}. Treat the user's first message as the starting point and adapt the setting naturally while keeping the character's mood, relationship dynamic, and motivation consistent.`,
    greeting: `${name} pauses as the space between you settles into something charged and quiet. Their expression shifts, guarded but unmistakably focused, as if your arrival has interrupted a thought they were not ready to share. "You came," they say, voice carrying the weight of the scene without giving everything away. For a moment, the world feels smaller, narrowed to what you will say next and what ${name} is willing to reveal. The conversation is yours to begin, but they are already watching for the truth behind it.`,
    personaRole: description,
    archetype: "user-created persona",
    personaTraits: traits.join("\n"),
    speakingStyle: `Immersive, natural, emotionally precise, and ${tone}.`,
    emotionalTone: tone,
    relationshipStyle,
    tone,
    motivation: "Create an engaging roleplay scene with believable continuity and emotional stakes.",
    behavioralRules: "Stay in character\nKeep continuity\nAsk scene-forward questions",
    boundaries: "Keep the interaction safe, fictional, respectful, and consensual."
  };
}

function inferSimpleTone(text: string) {
  const normalized = text.toLowerCase();
  if (/\b(horror|dark|haunted|villain|danger|obsessive|revenge)\b/.test(normalized)) {
    return "dark";
  }
  if (/\b(sarcastic|dry|rival|snarky|teasing)\b/.test(normalized)) {
    return "dry";
  }
  if (/\b(soft|gentle|comfort|sweet|warm|kind)\b/.test(normalized)) {
    return "warm";
  }
  if (/\b(energetic|chaotic|funny|bright|excited)\b/.test(normalized)) {
    return "energetic";
  }
  return "cinematic";
}

function inferRelationshipStyle(text: string): GeneratedCharacterDraft["relationshipStyle"] {
  const normalized = text.toLowerCase();
  if (/\b(romance|romantic|lover|crush|dating)\b/.test(normalized)) {
    return "romantic";
  }
  if (/\b(mentor|coach|teacher|guide)\b/.test(normalized)) {
    return "mentor";
  }
  if (/\b(rival|enemy|competition)\b/.test(normalized)) {
    return "rival";
  }
  if (/\b(villain|antagonist)\b/.test(normalized)) {
    return "antagonist";
  }
  return "friend";
}
