import { DEFAULT_MUSIC_SETTINGS, normalizeMusicSettings, type MusicSettings } from "@/lib/music-embed";

export type ChatBackgroundMode = "default" | "custom" | "none";
export type ChatBackgroundType = "auto" | "image" | "video";
export type ChatBackgroundFit = "cover" | "contain";
export type ChatBackgroundPosition = "center" | "top" | "bottom";

export type ChatAppearance = {
  backgroundMode: ChatBackgroundMode;
  backgroundUrl: string;
  backgroundType: ChatBackgroundType;
  backgroundFit: ChatBackgroundFit;
  backgroundPosition: ChatBackgroundPosition;
  backgroundDim: number;
  backgroundBlur: number;
  fontFamily: string;
  fontUrl: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  contentWidth: number;
  textColor: string;
  music: MusicSettings;
};

export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  backgroundMode: "default",
  backgroundUrl: "",
  backgroundType: "auto",
  backgroundFit: "cover",
  backgroundPosition: "center",
  backgroundDim: 0.58,
  backgroundBlur: 0,
  fontFamily: "Cormorant Garamond",
  fontUrl: "",
  fontSize: 24,
  fontWeight: 500,
  lineHeight: 1.5,
  contentWidth: 1000,
  textColor: "#f2eee6",
  music: DEFAULT_MUSIC_SETTINGS
};

export const CHAT_FONT_PRESETS = [
  { label: "Editorial", value: "Cormorant Garamond" },
  { label: "Classic serif", value: "Georgia" },
  { label: "Modern", value: "Inter" },
  { label: "System", value: "system-ui" },
  { label: "Monospace", value: "ui-monospace" }
] as const;

export function normalizeChatAppearance(value: unknown): ChatAppearance {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    backgroundMode: oneOf(input.backgroundMode, ["default", "custom", "none"], DEFAULT_CHAT_APPEARANCE.backgroundMode),
    backgroundUrl: stringValue(input.backgroundUrl, DEFAULT_CHAT_APPEARANCE.backgroundUrl),
    backgroundType: oneOf(input.backgroundType, ["auto", "image", "video"], DEFAULT_CHAT_APPEARANCE.backgroundType),
    backgroundFit: oneOf(input.backgroundFit, ["cover", "contain"], DEFAULT_CHAT_APPEARANCE.backgroundFit),
    backgroundPosition: oneOf(input.backgroundPosition, ["center", "top", "bottom"], DEFAULT_CHAT_APPEARANCE.backgroundPosition),
    backgroundDim: numberValue(input.backgroundDim, 0, 0.92, DEFAULT_CHAT_APPEARANCE.backgroundDim),
    backgroundBlur: numberValue(input.backgroundBlur, 0, 24, DEFAULT_CHAT_APPEARANCE.backgroundBlur),
    fontFamily: stringValue(input.fontFamily, DEFAULT_CHAT_APPEARANCE.fontFamily),
    fontUrl: stringValue(input.fontUrl, DEFAULT_CHAT_APPEARANCE.fontUrl),
    fontSize: numberValue(input.fontSize, 14, 38, DEFAULT_CHAT_APPEARANCE.fontSize),
    fontWeight: numberValue(input.fontWeight, 300, 800, DEFAULT_CHAT_APPEARANCE.fontWeight),
    lineHeight: numberValue(input.lineHeight, 1.15, 2.2, DEFAULT_CHAT_APPEARANCE.lineHeight),
    contentWidth: numberValue(input.contentWidth, 560, 1200, DEFAULT_CHAT_APPEARANCE.contentWidth),
    textColor: /^#[0-9a-f]{6}$/i.test(String(input.textColor ?? "")) ? String(input.textColor) : DEFAULT_CHAT_APPEARANCE.textColor,
    music: normalizeMusicSettings(input.music)
  };
}

export function resolveBackgroundType(url: string, selected: ChatBackgroundType): Exclude<ChatBackgroundType, "auto"> {
  if (selected !== "auto") {
    return selected;
  }
  return /\.(?:mp4|webm|mov)(?:$|[?#])/i.test(url) ? "video" : "image";
}

function oneOf<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? value as T : fallback;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value.slice(0, 1000) : fallback;
}

function numberValue(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
