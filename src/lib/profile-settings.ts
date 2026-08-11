import { DEFAULT_MUSIC_SETTINGS, normalizeMusicSettings, type MusicSettings } from "@/lib/music-embed";

export type ProfileThemePreset = "midnight" | "aurora" | "obsidian" | "crystal" | "ember" | "veil";
export type ProfileLayoutStyle = "minimal" | "showcase" | "grid";
export type ProfileSurfaceStyle = "glass" | "luminous" | "editorial";
export type ProfileAvatarShape = "circle" | "soft" | "square";
export type ProfileBannerHeight = "compact" | "cinematic" | "immersive";

export type ProfileSocialLinks = {
  twitter?: string;
  patreon?: string;
  discord?: string;
};

export type ProfileSettings = {
  bannerUrl?: string | null;
  useGradientBanner?: boolean;
  themePreset?: ProfileThemePreset;
  layoutStyle?: ProfileLayoutStyle;
  surfaceStyle?: ProfileSurfaceStyle;
  avatarShape?: ProfileAvatarShape;
  bannerHeight?: ProfileBannerHeight;
  socialLinks?: ProfileSocialLinks;
  fontFamily?: string;
  fontUrl?: string;
  fontScale?: number;
  music?: MusicSettings;
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  bannerUrl: null,
  useGradientBanner: true,
  themePreset: "midnight",
  layoutStyle: "grid",
  surfaceStyle: "glass",
  avatarShape: "circle",
  bannerHeight: "cinematic",
  socialLinks: {},
  fontFamily: "Inter",
  fontUrl: "",
  fontScale: 1,
  music: DEFAULT_MUSIC_SETTINGS
};

export const PROFILE_THEME_PRESETS: Record<
  ProfileThemePreset,
  { label: string; gradient: string; glassTint: string }
> = {
  midnight: {
    label: "Midnight",
    gradient:
      "linear-gradient(165deg, oklch(0.09 0.02 270) 0%, oklch(0.11 0.035 285) 50%, oklch(0.08 0.018 255) 100%)",
    glassTint: "rgba(255, 255, 255, 0.08)"
  },
  aurora: {
    label: "Aurora",
    gradient:
      "radial-gradient(ellipse 80% 60% at 20% 20%, oklch(0.35 0.12 160 / .35), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 80%, oklch(0.32 0.14 280 / .3), transparent 58%), linear-gradient(165deg, oklch(0.1 0.03 200) 0%, oklch(0.12 0.04 260) 100%)",
    glassTint: "rgba(120, 200, 180, 0.08)"
  },
  obsidian: {
    label: "Obsidian",
    gradient: "linear-gradient(180deg, oklch(0.07 0 0) 0%, oklch(0.11 0.01 280) 100%)",
    glassTint: "rgba(255, 255, 255, 0.06)"
  },
  crystal: {
    label: "Crystal",
    gradient:
      "radial-gradient(ellipse 60% 50% at 50% 0%, oklch(0.45 0.08 240 / .22), transparent 60%), linear-gradient(165deg, oklch(0.12 0.04 250) 0%, oklch(0.09 0.02 280) 100%)",
    glassTint: "rgba(180, 210, 255, 0.1)"
  },
  ember: {
    label: "Ember",
    gradient:
      "radial-gradient(ellipse 70% 55% at 18% 12%, oklch(0.58 0.18 38 / .34), transparent 58%), radial-gradient(ellipse 62% 50% at 86% 86%, oklch(0.42 0.13 325 / .24), transparent 62%), linear-gradient(150deg, oklch(0.12 0.035 25) 0%, oklch(0.09 0.025 305) 100%)",
    glassTint: "rgba(246, 126, 92, 0.1)"
  },
  veil: {
    label: "Veil",
    gradient:
      "radial-gradient(ellipse 72% 56% at 16% 18%, oklch(0.56 0.13 305 / .28), transparent 60%), radial-gradient(ellipse 64% 54% at 82% 76%, oklch(0.62 0.11 205 / .2), transparent 62%), linear-gradient(155deg, oklch(0.11 0.035 285) 0%, oklch(0.09 0.025 235) 100%)",
    glassTint: "rgba(190, 154, 255, 0.1)"
  }
};

export function parseProfileSettings(raw: unknown): ProfileSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PROFILE_SETTINGS };
  }

  const value = raw as Record<string, unknown>;
  const social = (value.socialLinks && typeof value.socialLinks === "object"
    ? value.socialLinks
    : {}) as Record<string, unknown>;

  return {
    bannerUrl: typeof value.bannerUrl === "string" ? value.bannerUrl : null,
    useGradientBanner: value.useGradientBanner !== false,
    themePreset: isThemePreset(value.themePreset) ? value.themePreset : "midnight",
    layoutStyle: isLayoutStyle(value.layoutStyle) ? value.layoutStyle : "grid",
    surfaceStyle: isSurfaceStyle(value.surfaceStyle) ? value.surfaceStyle : "glass",
    avatarShape: isAvatarShape(value.avatarShape) ? value.avatarShape : "circle",
    bannerHeight: isBannerHeight(value.bannerHeight) ? value.bannerHeight : "cinematic",
    fontFamily: typeof value.fontFamily === "string" ? value.fontFamily.slice(0, 120) : "Inter",
    fontUrl: typeof value.fontUrl === "string" ? value.fontUrl.slice(0, 1000) : "",
    fontScale: typeof value.fontScale === "number" ? Math.min(1.3, Math.max(0.85, value.fontScale)) : 1,
    music: normalizeMusicSettings(value.music),
    socialLinks: {
      twitter: typeof social.twitter === "string" ? social.twitter : "",
      patreon: typeof social.patreon === "string" ? social.patreon : "",
      discord: typeof social.discord === "string" ? social.discord : ""
    }
  };
}

function isThemePreset(value: unknown): value is ProfileThemePreset {
  return value === "midnight" || value === "aurora" || value === "obsidian" || value === "crystal" || value === "ember" || value === "veil";
}

function isLayoutStyle(value: unknown): value is ProfileLayoutStyle {
  return value === "minimal" || value === "showcase" || value === "grid";
}

function isSurfaceStyle(value: unknown): value is ProfileSurfaceStyle {
  return value === "glass" || value === "luminous" || value === "editorial";
}

function isAvatarShape(value: unknown): value is ProfileAvatarShape {
  return value === "circle" || value === "soft" || value === "square";
}

function isBannerHeight(value: unknown): value is ProfileBannerHeight {
  return value === "compact" || value === "cinematic" || value === "immersive";
}

export function publicProfileUrl(username: string) {
  return `/u/${username}`;
}
