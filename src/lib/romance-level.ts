export function romanceLevelInstruction(value: number) {
  const level = Number.isFinite(value) ? Math.max(0, Math.min(10, Math.round(value))) : 3;
  if (level === 0) return "Do not initiate or imply romance; keep the relationship non-romantic.";
  if (level <= 3) return "Keep romance in the background and respond only to clear, appropriate cues.";
  if (level <= 6) return "Allow mutual romantic interest to develop when the scene supports it.";
  if (level <= 9) return "Proactively advance established, consensual romantic tension through character-specific dialogue and actions.";
  return "At eligible moments, actively advance established, consensual romance in each response instead of leaving the setting inert; preserve pacing, character boundaries, and player agency.";
}
