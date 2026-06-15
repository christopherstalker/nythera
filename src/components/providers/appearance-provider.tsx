"use client";

import { useEffect } from "react";

export const DEFAULT_ACCENT_COLOR = "#a78bfa";
export const APPEARANCE_STORAGE_KEY = "velora.appearance";

export type StoredAppearance = {
  accentColor?: string;
};

export const ACCENT_PRESETS = ["#a78bfa", "#2dd4bf", "#ef476f", "#38bdf8", "#f59e0b", "#f472b6", "#64748b"];

export function AppearanceProvider() {
  useEffect(() => {
    applyStoredAppearance();

    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_STORAGE_KEY) {
        applyStoredAppearance();
      }
    };

    const onAppearanceUpdated = (event: Event) => {
      const detail = (event as CustomEvent<StoredAppearance>).detail;
      applyAccentColor(detail?.accentColor || readStoredAppearance().accentColor || DEFAULT_ACCENT_COLOR);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("velora:appearance-updated", onAppearanceUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("velora:appearance-updated", onAppearanceUpdated);
    };
  }, []);

  return null;
}

export function readStoredAppearance(): StoredAppearance {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as StoredAppearance;
    return isHexColor(parsed.accentColor) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredAppearance(next: StoredAppearance) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readStoredAppearance();
  const merged = {
    ...current,
    ...next
  };

  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent<StoredAppearance>("velora:appearance-updated", { detail: merged }));
}

export function applyAccentColor(hexColor: string) {
  if (typeof document === "undefined" || !isHexColor(hexColor)) {
    return;
  }

  const rgb = hexToRgb(hexColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hover = mixWith(rgb, 0, 0, 0, 0.14);
  const root = document.documentElement;

  root.style.setProperty("--accent-purple", hexColor);
  root.style.setProperty("--accent-purple-hover", rgbToHex(hover));
  root.style.setProperty("--accent-purple-soft", `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.16)`);
  root.style.setProperty("--accent-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
  root.style.setProperty("--bubble-user", `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.24)`);
  root.style.setProperty("--primary", `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`);
  root.style.setProperty("--accent", `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`);
  root.style.setProperty("--ring", `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`);
}

function applyStoredAppearance() {
  applyAccentColor(readStoredAppearance().accentColor || DEFAULT_ACCENT_COLOR);
}

function isHexColor(value?: string): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
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

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return {
    h: (hue / 6) * 360,
    s: saturation * 100,
    l: lightness * 100
  };
}
