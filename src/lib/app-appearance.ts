import { z } from "zod";
import { formatOklchChannels, hexToOklch } from "@/lib/color/oklch";

const hexColor = z.string().regex(/^#[\da-f]{6}$/i, "Use a six-digit hex color, such as #07131F.");

export const appAppearanceSchema = z
  .object({
    version: z.literal(1),
    preset: z.string().min(1).max(40),
    colors: z
      .object({
        background: hexColor,
        surface: hexColor,
        elevated: hexColor,
        text: hexColor,
        muted: hexColor,
        accent: hexColor,
        secondary: hexColor,
        border: hexColor
      })
      .strict(),
    font: z.enum(["space-grotesk", "system", "serif"]),
    fontSize: z.number().int().min(14).max(20),
    roundness: z.number().int().min(0).max(28),
    density: z.enum(["comfortable", "compact"]),
    surfaceOpacity: z.number().int().min(60).max(100),
    blur: z.number().int().min(0).max(24),
    reduceMotion: z.boolean()
  })
  .strict();

export type AppAppearance = z.infer<typeof appAppearanceSchema>;

export const DEFAULT_APP_APPEARANCE: AppAppearance = {
  version: 1,
  preset: "ocean",
  colors: {
    background: "#050C14",
    surface: "#091724",
    elevated: "#102538",
    text: "#CCD8E2",
    muted: "#8C9FB0",
    accent: "#39B8AB",
    secondary: "#81A4CE",
    border: "#254052"
  },
  font: "space-grotesk",
  fontSize: 16,
  roundness: 12,
  density: "comfortable",
  surfaceOpacity: 88,
  blur: 12,
  reduceMotion: false
};

export const APP_THEME_PRESETS = [
  { id: "ocean", name: "Abyss", description: "Deep ocean blue · teal", appearance: DEFAULT_APP_APPEARANCE },
  {
    id: "mountain",
    name: "Alpine",
    description: "Black pine · cool jade",
    appearance: {
      ...DEFAULT_APP_APPEARANCE,
      preset: "mountain",
      colors: {
        background: "#070D0B",
        surface: "#101C17",
        elevated: "#1A2C23",
        text: "#D2DCD4",
        muted: "#94AA9B",
        accent: "#69B990",
        secondary: "#A6BFA2",
        border: "#2C4435"
      }
    }
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Midnight violet · amethyst",
    appearance: {
      ...DEFAULT_APP_APPEARANCE,
      preset: "aurora",
      colors: {
        background: "#0B0813",
        surface: "#161023",
        elevated: "#241A36",
        text: "#DAD2E5",
        muted: "#A899BA",
        accent: "#A585E3",
        secondary: "#73BAAD",
        border: "#3E2E53"
      }
    }
  },
  {
    id: "ember",
    name: "Ember",
    description: "Obsidian · burnished copper",
    appearance: {
      ...DEFAULT_APP_APPEARANCE,
      preset: "ember",
      colors: {
        background: "#100A08",
        surface: "#201510",
        elevated: "#322117",
        text: "#E0D3C6",
        muted: "#B29C89",
        accent: "#D3976E",
        secondary: "#C9AF83",
        border: "#4C3426"
      }
    }
  },
  {
    id: "paper",
    name: "Parchment",
    description: "Warm paper · forest ink",
    appearance: {
      ...DEFAULT_APP_APPEARANCE,
      preset: "paper",
      colors: {
        background: "#EFE9DD",
        surface: "#E5DCCE",
        elevated: "#D9CCBA",
        text: "#302D27",
        muted: "#5C5145",
        accent: "#37624C",
        secondary: "#82492F",
        border: "#A29580"
      },
      surfaceOpacity: 100
    }
  }
] satisfies Array<{ id: string; name: string; description: string; appearance: AppAppearance }>;

export function parseAppAppearance(value: unknown): AppAppearance | null {
  const parsed = appAppearanceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first: string, second: string) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function appAppearanceStyle(appearance: AppAppearance): Record<string, string> {
  const { colors, roundness, surfaceOpacity, blur } = appearance;
  const channels = (color: string) => formatOklchChannels(hexToOklch(color));
  const onAccent =
    contrastRatio(colors.accent, "#080B10") > contrastRatio(colors.accent, "#FFFFFF") ? "#080B10" : "#FFFFFF";
  const semantic = {
    canvas: colors.background,
    surface: colors.surface,
    elevated: colors.elevated,
    "text-primary": colors.text,
    "text-secondary": colors.muted,
    "text-muted": colors.muted,
    "text-disabled": colors.muted,
    "border-default": colors.border,
    "border-subtle": colors.border,
    "border-strong": colors.border,
    "border-disabled": colors.border,
    "accent-primary": colors.accent,
    "accent-strong": colors.accent,
    "accent-secondary": colors.secondary,
    "focus-ring": colors.accent,
    "on-accent": onAccent
  };
  const styles: Record<string, string> = {};
  for (const [name, color] of Object.entries(semantic)) styles[`--color-${name}`] = channels(color);
  const aliases = {
    "bg-base": colors.background,
    "bg-surface": colors.surface,
    "bg-elevated": colors.elevated,
    "bg-input": colors.surface,
    "text-primary": colors.text,
    "text-secondary": colors.muted,
    "text-muted": colors.muted,
    "border-default": colors.border,
    "border-subtle": colors.border,
    "border-strong": colors.border,
    "brand-primary": colors.accent,
    "brand-primary-hover": colors.accent,
    "brand-secondary": colors.secondary,
    "brand-secondary-deep": colors.secondary,
    "accent-purple": colors.accent,
    "accent-purple-hover": colors.accent,
    "accent-secondary": colors.secondary,
    "accent-teal": colors.secondary,
    "codex-paper": colors.background,
    "codex-paper-raised": colors.surface,
    "codex-paper-soft": colors.elevated,
    "codex-ivory": colors.text,
    "codex-rule": colors.border,
    "codex-mint": colors.secondary,
    "codex-violet": colors.accent,
    "accent-mint": colors.secondary,
    "accent-violet": colors.accent,
    "bubble-user": colors.accent,
    "bubble-char": colors.surface
  };
  for (const [name, color] of Object.entries(aliases)) styles[`--${name}`] = color;
  const fonts = {
    "space-grotesk": 'var(--font-space-grotesk), "Segoe UI", sans-serif',
    system: "system-ui, sans-serif",
    serif: '"Lora", Georgia, serif'
  };
  return {
    ...styles,
    colorScheme: luminance(colors.background) > 0.35 ? "light" : "dark",
    "--app-font-family": fonts[appearance.font],
    "--app-font-size": `${appearance.fontSize}px`,
    "--app-control-radius": `${roundness}px`,
    "--app-card-radius": `${Math.round(roundness * 1.5)}px`,
    "--radius-compact": `${Math.round(roundness / 3)}px`,
    "--radius-control": `${roundness}px`,
    "--radius-card": `${Math.round(roundness * 1.5)}px`,
    "--radius-surface": `${roundness * 2}px`,
    "--radius-panel": `${roundness * 2}px`,
    "--app-control-padding": appearance.density === "compact" ? "8px" : "12px",
    "--app-grid-gap": appearance.density === "compact" ? "12px" : "20px",
    "--glass-surface-subtle": `${surfaceOpacity}%`,
    "--glass-surface-standard": `${surfaceOpacity}%`,
    "--glass-surface-strong": `${surfaceOpacity}%`,
    "--glass-blur-sm": `${blur}px`,
    "--glass-blur-md": `${blur}px`,
    "--glass-blur-lg": `${blur}px`,
    "--neo-glass-blur-sm": `${blur}px`,
    "--neo-glass-blur-md": `${blur}px`,
    "--neo-glass-blur-lg": `${blur}px`,
    "--neo-glass-blur-chat": `${blur}px`,
    "--neo-glass-bg-standard": `color-mix(in srgb, ${colors.surface} ${surfaceOpacity}%, transparent)`,
    "--neo-glass-bg-subtle": `color-mix(in srgb, ${colors.surface} ${surfaceOpacity}%, transparent)`,
    "--accent-purple-soft": `color-mix(in srgb, ${colors.accent} 14%, transparent)`,
    "--accent-rgb": [1, 3, 5].map((start) => Number.parseInt(colors.accent.slice(start, start + 2), 16)).join(" ")
  };
}
