"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { formatOklchChannels, hexToOklch } from "@/lib/color/oklch";

export const DEFAULT_ACCENT_COLOR = "#8F81F7";
export const APPEARANCE_STORAGE_KEY = "nythera.appearance";
const LEGACY_APPEARANCE_STORAGE_KEY = "nythera.appearance";
const APPEARANCE_UPDATED_EVENT = "nythera:appearance-updated";
const BRAND_STATE_EVENT = "nythera:brand-state";
const BRAND_LOGO_PRIMARY = "#8F81F7";
const BRAND_LOGO_SECONDARY = "#6EE7D8";
const THEME_COLOR_DARK = "#03040F";
const THEME_COLOR_LIGHT = "#F0F3FC";

export type StoredAppearance = {
  accentColor?: string;
  theme?: "dark";
  glowIntensity?: number;
};

export const ACCENT_PRESETS = ["#8F81F7", "#6EE7D8", "#A78BFA", "#2DD4BF", "#EF476F", "#38BDF8", "#F472B6", "#64748B"];

export function AppearanceProvider() {
  const { setTheme } = useTheme();

  useEffect(() => {
    applyStoredAppearance(setTheme);
    syncAppearanceFromAccount(setTheme);

    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_STORAGE_KEY || event.key === LEGACY_APPEARANCE_STORAGE_KEY) {
        applyStoredAppearance(setTheme);
      }
    };

    const onAppearanceUpdated = (event: Event) => {
      const detail = (event as CustomEvent<StoredAppearance>).detail;
      applyAccentColor(detail?.accentColor || readStoredAppearance().accentColor || DEFAULT_ACCENT_COLOR);
      updateDynamicFavicon(detail?.glowIntensity ?? 0.56);
      setTheme("dark");
    };

    const onBrandState = (event: Event) => {
      const detail = (event as CustomEvent<{ glowIntensity?: number }>).detail;
      updateDynamicFavicon(detail?.glowIntensity ?? 0.56);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(APPEARANCE_UPDATED_EVENT, onAppearanceUpdated);
    window.addEventListener(BRAND_STATE_EVENT, onBrandState);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(APPEARANCE_UPDATED_EVENT, onAppearanceUpdated);
      window.removeEventListener(BRAND_STATE_EVENT, onBrandState);
    };
  }, [setTheme]);

  return null;
}

export function readStoredAppearance(): StoredAppearance {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_APPEARANCE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as StoredAppearance;
    return {
      accentColor: isHexColor(parsed.accentColor) ? parsed.accentColor : undefined,
      theme: isTheme(parsed.theme) ? parsed.theme : "dark"
    };
  } catch {
    return {};
  }
}

export function saveStoredAppearance(next: StoredAppearance, options: { sync?: boolean } = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readStoredAppearance();
  const merged = {
    ...current,
    ...next
  };

  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent<StoredAppearance>(APPEARANCE_UPDATED_EVENT, { detail: merged }));

  if (options.sync !== false) {
    persistAccountAppearance(merged);
  }
}

export function applyAccentColor(hexColor: string) {
  if (typeof document === "undefined" || !isHexColor(hexColor)) {
    return;
  }

  const rgb = hexToRgb(hexColor);
  const hover = mixWith(rgb, 0, 0, 0, 0.14);
  const primaryChannels = formatOklchChannels(hexToOklch(hexColor));
  const strongChannels = formatOklchChannels(hexToOklch(rgbToHex(hover)));
  const root = document.documentElement;

  root.style.setProperty("--color-accent-primary", primaryChannels);
  root.style.setProperty("--color-accent-strong", strongChannels);
  root.style.setProperty("--primary", primaryChannels);
  root.style.setProperty("--accent", primaryChannels);
  root.style.setProperty("--ring", primaryChannels);
  root.style.setProperty("--brand-primary", `oklch(${primaryChannels})`);
  root.style.setProperty("--brand-primary-hover", `oklch(${strongChannels})`);
  root.style.setProperty("--brand-glow", `oklch(${primaryChannels} / .15)`);
  root.style.setProperty("--brand-glow-strong", `oklch(${primaryChannels} / .28)`);
  root.style.setProperty("--accent-purple", `oklch(${primaryChannels})`);
  root.style.setProperty("--accent-purple-hover", `oklch(${strongChannels})`);
  root.style.setProperty("--accent-purple-soft", `oklch(${primaryChannels} / .16)`);
  root.style.setProperty("--accent-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
  root.style.setProperty("--bubble-user", `oklch(${primaryChannels} / .24)`);
  updateDynamicFavicon();
}

function applyStoredAppearance(setTheme?: (theme: string) => void) {
  const appearance = readStoredAppearance();
  applyAccentColor(appearance.accentColor || DEFAULT_ACCENT_COLOR);
  if (isTheme(appearance.theme)) {
    setTheme?.("dark");
  }
}

function isHexColor(value?: string): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isTheme(value?: string): value is NonNullable<StoredAppearance["theme"]> {
  return value === "dark";
}

async function syncAppearanceFromAccount(setTheme: (theme: string) => void) {
  try {
    const response = await fetch("/api/profile", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const body = await response.json();
    const profile = body?.profile;
    const next: StoredAppearance = {
      accentColor: isHexColor(profile?.accentColor) ? profile.accentColor : undefined,
      theme: "dark"
    };

    if (!next.accentColor && !next.theme) {
      return;
    }

    saveStoredAppearance(next, { sync: false });
    applyAccentColor(next.accentColor || readStoredAppearance().accentColor || DEFAULT_ACCENT_COLOR);
    setTheme("dark");
  } catch {
    // Anonymous sessions and offline PWA starts keep using local appearance.
  }
}

function persistAccountAppearance(appearance: StoredAppearance) {
  const payload: Record<string, string> = {};
  if (isHexColor(appearance.accentColor)) {
    payload.accentColor = appearance.accentColor;
  }
  if (isTheme(appearance.theme)) {
    payload.preferredTheme = appearance.theme;
  }

  if (!Object.keys(payload).length) {
    return;
  }

  void fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => undefined);
}

function hexToRgb(hexColor: string) {
  const value = hexColor.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function mixWith(rgb: { r: number; g: number; b: number }, r: number, g: number, b: number, amount: number) {
  return {
    r: Math.round(rgb.r * (1 - amount) + r * amount),
    g: Math.round(rgb.g * (1 - amount) + g * amount),
    b: Math.round(rgb.b * (1 - amount) + b * amount)
  };
}

function updateDynamicFavicon(glowIntensity = 0.56) {
  if (typeof document === "undefined") {
    return;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="92" fill="#141414"/><path d="M112 104L326 282V148L392 198V414L178 236V370L112 320Z" fill="${BRAND_LOGO_PRIMARY}"/><path d="M326 282V148L392 198V414L326 359Z" fill="${BRAND_LOGO_SECONDARY}" opacity="${glowIntensity}"/></svg>`;
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const link = getOrCreateIconLink();
  link.href = href;
  link.type = "image/svg+xml";

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) {
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
    themeColor.content = prefersLight ? THEME_COLOR_LIGHT : THEME_COLOR_DARK;
  }
}

function getOrCreateIconLink() {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-nythera-dynamic="true"]');
  if (existing) {
    return existing;
  }

  const link = document.createElement("link");
  link.rel = "icon";
  link.setAttribute("data-nythera-dynamic", "true");
  document.head.appendChild(link);
  return link;
}
