"use client";

import { useEffect } from "react";

export const CHAT_CUSTOM_FONT_FAMILY = "Nythera Chat Custom";
export const PROFILE_CUSTOM_FONT_FAMILY = "Nythera Profile Custom";

export function useCustomFontFace(fontUrl: string | null | undefined, family: string) {
  useEffect(() => {
    if (!fontUrl || typeof FontFace === "undefined" || !document.fonts) {
      return;
    }

    let active = true;
    let loadedFace: FontFace | null = null;
    const face = new FontFace(family, `url(${JSON.stringify(fontUrl)})`, { display: "swap" });

    void face.load().then((loaded) => {
      if (!active) return;
      loadedFace = loaded;
      document.fonts.add(loaded);
    }).catch(() => undefined);

    return () => {
      active = false;
      if (loadedFace) document.fonts.delete(loadedFace);
    };
  }, [family, fontUrl]);
}
