export const SUPPORT_EMAIL = "support@nythera.art";
export const PATREON_SUPPORT_URL = "https://www.patreon.com/c/ChristopherStalker";

export const SUPPORT_CATEGORIES = [
  { value: "bug", label: "Bug report" },
  { value: "suggestion", label: "Suggestion" },
  { value: "account", label: "Account help" },
  { value: "safety", label: "Safety concern" }
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];

export function supportCategoryLabel(value: SupportCategory) {
  return SUPPORT_CATEGORIES.find((category) => category.value === value)?.label ?? "Support request";
}
