export const SKIP_TIME_COMMAND = "<skiptime>";

export const SKIP_TIME_UNITS = ["minute", "hour", "day", "week", "month", "year"] as const;

export type SkipTimeUnit = (typeof SKIP_TIME_UNITS)[number];
export type SkipTimeDuration = { value: number; unit: SkipTimeUnit };

export const SKIP_TIME_PROMPT = [
  "Advance the roleplay to the next meaningful point in time.",
  "Choose a natural amount of elapsed time from the current scene and make the transition explicit in the opening sentence.",
  "Preserve established relationships, promises, injuries, possessions, locations, unresolved tensions, and story canon.",
  "Briefly show what materially changed during the skipped interval, then begin a concrete new scene with immediate character initiative.",
  "Do not summarize the whole conversation, do not speak for the player, and do not ask how much time should pass."
].join(" ");

export function buildSkipTimePrompt(duration?: SkipTimeDuration | null) {
  if (!duration) return SKIP_TIME_PROMPT;

  const label = `${duration.value} ${duration.unit}${duration.value === 1 ? "" : "s"}`;
  return [
    `Advance the roleplay by exactly ${label}.`,
    "Make the elapsed interval explicit in the opening sentence and do not substitute a different duration.",
    "Preserve established relationships, promises, injuries, possessions, locations, unresolved tensions, and story canon.",
    "Briefly show only what materially changed during the interval, then begin a concrete new scene with immediate character initiative.",
    "Do not summarize the whole conversation, do not speak for the player, and do not ask how much time should pass."
  ].join(" ");
}

export function resolveChatActionMessage(value: string) {
  const persistedContent = value.trim();
  if (persistedContent.toLocaleLowerCase() === SKIP_TIME_COMMAND) {
    return {
      kind: "skip-time" as const,
      persistedContent: SKIP_TIME_COMMAND,
      promptContent: SKIP_TIME_PROMPT
    };
  }

  return {
    kind: "message" as const,
    persistedContent,
    promptContent: persistedContent
  };
}
