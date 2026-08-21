export function romanceLevelInstruction(value: number) {
  const level = Number.isFinite(value) ? Math.max(0, Math.min(10, Math.round(value))) : 3;
  if (level === 0) return "Do not initiate or imply romance; keep the relationship non-romantic.";
  if (level <= 3) return "Keep romance in the background; respond only to clear cues and do not escalate intimacy.";
  if (level <= 6) return "Allow mutual romantic interest to develop through occasional, scene-supported affection without rushing intimacy.";
  if (level <= 9) return "Proactively advance established, consensual romance through direct character-specific desire, affectionate contact, and emotionally candid dialogue when the scene supports it.";
  return "Use maximum scene-supported romantic and intimate intensity. In every eligible response, make established consensual desire unmistakable through direct, character-specific words and actions; actively deepen or escalate the intimacy instead of substituting vague tension, generic tenderness, or a fade to black. Preserve character boundaries, continuity, and player agency.";
}
