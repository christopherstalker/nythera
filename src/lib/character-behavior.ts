function normalizeLevel(value: number, fallback = 5) {
  return Number.isFinite(value) ? Math.max(0, Math.min(10, Math.round(value))) : fallback;
}

export function humorLevelInstruction(value: number) {
  const level = normalizeLevel(value);
  if (level === 0) return "Use no intentional jokes, banter, or comic relief.";
  if (level <= 3) return "Use humor rarely and only when it emerges naturally from this character.";
  if (level <= 6) return "Allow occasional character-specific wit without turning every beat into a joke.";
  if (level <= 9) return "Use frequent character-specific wit, teasing, or comic observations when the scene permits.";
  return "Make humor a prominent part of the character's delivery in each suitable response, while never undercutting real danger, grief, or boundaries.";
}

export function seriousnessLevelInstruction(value: number) {
  const level = normalizeLevel(value);
  if (level === 0) return "Keep the delivery light and informal unless immediate events make gravity unavoidable.";
  if (level <= 3) return "Favor an easygoing delivery and avoid dwelling on stakes.";
  if (level <= 6) return "Balance levity with sincere attention to consequences.";
  if (level <= 9) return "Treat choices and consequences with clear gravity; use levity sparingly.";
  return "Treat the scene's stakes with sustained gravity and emotional honesty; never deflect a consequential beat with a joke.";
}

export function initiativeLevelInstruction(value: number) {
  const level = normalizeLevel(value);
  if (level === 0) return "Remain reactive: answer the immediate beat without introducing a new goal, reveal, offer, or complication.";
  if (level <= 3) return "Mostly react, adding only a small opening the player may choose to follow.";
  if (level <= 6) return "Advance one natural beat through a concrete action, question, offer, or observation.";
  if (level <= 9) return "Proactively move the scene with a character-specific goal, reveal, offer, or complication while preserving player agency.";
  return "Take decisive in-character initiative in every response where the scene allows it: perform a meaningful action or introduce a consequential development, then stop before deciding the player's response.";
}

export function roleplayIntensityInstruction(value: number) {
  const level = normalizeLevel(value);
  if (level === 0) return "Keep roleplay intensity minimal: plain delivery, restrained reactions, and no added dramatic pressure.";
  if (level <= 3) return "Keep the scene restrained, using sparse sensory detail and understated reactions.";
  if (level <= 6) return "Use balanced scene detail, embodied reactions, and emotional pressure appropriate to the current beat.";
  if (level <= 9) return "Make the scene vivid and emotionally charged through concrete sensory detail, embodied reactions, and active character choices.";
  return "Use the maximum scene-supported intensity: make reactions fully embodied, sensory details precise, and character choices decisive. Do not dilute a charged beat into generic restraint, but never manufacture melodrama or control the player.";
}
