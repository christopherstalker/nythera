export const TUTORIAL_CHARACTER_ID = "cmtj0lhg40001l204wqm7wgnp";
export const TUTORIAL_STEP_COUNT = 5;

export const TUTORIAL_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED"] as const;
export type TutorialStatus = (typeof TUTORIAL_STATUSES)[number];

export const TUTORIAL_ROUTE_CHOICES = ["car", "helicopter"] as const;
export type TutorialRouteChoice = (typeof TUTORIAL_ROUTE_CHOICES)[number];

export const TUTORIAL_PERSONA_CHOICES = ["strategist", "daredevil", "scout"] as const;
export type TutorialPersonaChoice = (typeof TUTORIAL_PERSONA_CHOICES)[number];

export const TUTORIAL_MEMORY_CHOICES = ["tuna", "shield", "grappler"] as const;
export type TutorialMemoryChoice = (typeof TUTORIAL_MEMORY_CHOICES)[number];

export type TutorialState = {
  routeChoice?: TutorialRouteChoice;
  personaChoice?: TutorialPersonaChoice;
  memoryChoice?: TutorialMemoryChoice;
  alternateRouteViewed?: boolean;
};

export function clampTutorialStep(value: unknown) {
  const step = typeof value === "number" && Number.isInteger(value) ? value : 0;
  return Math.min(TUTORIAL_STEP_COUNT, Math.max(0, step));
}

export function parseTutorialState(value: unknown): TutorialState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const state = value as Record<string, unknown>;
  return {
    routeChoice: isChoice(state.routeChoice, TUTORIAL_ROUTE_CHOICES) ? state.routeChoice : undefined,
    personaChoice: isChoice(state.personaChoice, TUTORIAL_PERSONA_CHOICES) ? state.personaChoice : undefined,
    memoryChoice: isChoice(state.memoryChoice, TUTORIAL_MEMORY_CHOICES) ? state.memoryChoice : undefined,
    alternateRouteViewed: state.alternateRouteViewed === true
  };
}

function isChoice<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.includes(value as T);
}
