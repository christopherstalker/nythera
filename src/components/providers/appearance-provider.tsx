"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { formatOklchChannels, hexToOklch } from "@/lib/color/oklch";

export const DEFAULT_ACCENT_COLOR = "#8F81F7";
export const APPEARANCE_STORAGE_KEY = "nythera.appearance";
const LEGACY_APPEARANCE_STORAGE_KEY = "nythera.appearance";
const APPEARANCE_UPDATED_EVENT = "nythera:appearance-updated";
const BRAND_STATE_EVENT = "nythera:brand-state";

export type StoredAppearance = {
  accentColor?: string;
  theme?: "dark" | "light" | "system";
};

export const ACCENT_PRESETS = ["#FF7A18", "#FFB347", "#A78BFA", "#2DD4BF", "#EF476F", "#38BDF8", "#F472B6", "#64748B"];

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
      if (isTheme(detail?.theme)) {
        setTheme(detail.theme);
      }
    };

    const onBrandState = (event: Event) => {
      const detail = (event as CustomEvent<{ glowIntensity?: number }>).detail;
      const accentColor = readStoredAppearance().accentColor || DEFAULT_ACCENT_COLOR;
      updateDynamicFavicon(accentColor, detail?.glowIntensity ?? 0.56);
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
      theme: isTheme(parsed.theme) ? parsed.theme : undefined
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
  updateDynamicFavicon(hexColor);
}

function applyStoredAppearance(setTheme?: (theme: string) => void) {
  const appearance = readStoredAppearance();
  applyAccentColor(appearance.accentColor || DEFAULT_ACCENT_COLOR);
  if (isTheme(appearance.theme)) {
    setTheme?.(appearance.theme);
  }
}

function isHexColor(value?: string): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isTheme(value?: string): value is NonNullable<StoredAppearance["theme"]> {
  return value === "dark" || value === "light" || value === "system";
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
      theme: isTheme(profile?.preferredTheme) ? profile.preferredTheme : undefined
    };

    if (!next.accentColor && !next.theme) {
      return;
    }

    saveStoredAppearance(next, { sync: false });
    applyAccentColor(next.accentColor || readStoredAppearance().accentColor || DEFAULT_ACCENT_COLOR);
    if (next.theme) {
      setTheme(next.theme);
    }
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

function updateDynamicFavicon(hexColor: string, glowIntensity = 0.56) {
  if (typeof document === "undefined" || !isHexColor(hexColor)) {
    return;
  }

  // Runtime branding keeps the SVG favicon aligned with the selected theme accent and chat glow state.
  const rgb = hexToRgb(hexColor);
  const secondary = mixWith(rgb, 255, 179, 71, 0.45);
  const glow = Math.max(0.14, Math.min(glowIntensity, 0.9));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="b" x1="80" y1="60" x2="430" y2="470"><stop stop-color="#18151E"/><stop offset=".58" stop-color="#0B0B12"/><stop offset="1" stop-color="#050509"/></linearGradient><linearGradient id="e" x1="112" y1="104" x2="392" y2="414"><stop stop-color="${rgbToHex(secondary)}"/><stop offset=".5" stop-color="${hexColor}"/><stop offset="1" stop-color="${rgbToHex(mixWith(rgb, 0, 0, 0, 0.26))}"/></linearGradient><filter id="g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18" result="blur"/><feColorMatrix in="blur" type="matrix" values="1 0 0 0 ${rgb.r / 255} 0 1 0 0 ${rgb.g / 255} 0 0 1 0 ${rgb.b / 255} 0 0 0 ${glow} 0"/></filter></defs><rect width="512" height="512" rx="92" fill="url(#b)"/><path d="M112 104L326 282V148L392 198V414L178 236V370L112 320Z" fill="url(#e)" filter="url(#g)" opacity=".5"/><path d="M112 104L326 282V148L392 198V414L178 236V370L112 320Z" fill="url(#e)"/></svg>`;
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const link = getOrCreateIconLink();
  link.href = href;
  link.type = "image/svg+xml";

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = document.documentElement.classList.contains("light") ? "#F0F3FC" : "#03040F";
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
