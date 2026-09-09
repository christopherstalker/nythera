"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { appAppearanceSchema, appAppearanceStyle, type AppAppearance } from "@/lib/app-appearance";
import { BRAND_THEME_COLOR } from "@/lib/brand";

type AppearanceContext = {
  appearance: AppAppearance | null;
  ready: boolean;
  error: string | null;
  save: (appearance: AppAppearance | null) => Promise<void>;
  reload: () => void;
};

const Context = createContext<AppearanceContext | null>(null);

export function AppAppearanceProvider({
  children,
  initialAppearance = null,
  initialUserId = null
}: {
  children: React.ReactNode;
  initialAppearance?: AppAppearance | null;
  initialUserId?: string | null;
}) {
  const { data: session, status } = useSession();
  const userId = status === "loading" ? initialUserId : (session?.user?.id ?? null);
  const [snapshot, setSnapshot] = useState({
    userId: initialUserId,
    appearance: initialAppearance,
    ready: Boolean(initialUserId),
    error: null as string | null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const requestVersion = useRef(0);
  const activeUser = useRef(userId);
  useLayoutEffect(() => {
    activeUser.current = userId;
  }, [userId]);
  const appearance = snapshot.userId === userId ? snapshot.appearance : null;
  const ready = status !== "loading" && Boolean(userId) && snapshot.userId === userId && snapshot.ready;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const styles = appearance ? appAppearanceStyle(appearance) : {};
    for (const [property, value] of Object.entries(styles)) {
      if (property === "colorScheme") root.style.colorScheme = value;
      else root.style.setProperty(property, value);
    }
    root.toggleAttribute("data-personal-appearance", Boolean(appearance));
    root.toggleAttribute("data-reduce-motion", Boolean(appearance?.reduceMotion));
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", appearance?.colors.background ?? BRAND_THEME_COLOR);
    return () => {
      for (const property of Object.keys(styles)) {
        if (property === "colorScheme") root.style.removeProperty("color-scheme");
        else root.style.removeProperty(property);
      }
      root.removeAttribute("data-personal-appearance");
      root.removeAttribute("data-reduce-motion");
      meta?.setAttribute("content", BRAND_THEME_COLOR);
    };
  }, [appearance]);

  useEffect(() => {
    if (status === "loading") return;
    const version = ++requestVersion.current;
    if (!userId) {
      setSnapshot({ userId: null, appearance: null, ready: false, error: null });
      return;
    }
    const controller = new AbortController();
    void fetch("/api/settings/theme", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load your theme.");
        const savedAppearance = body.appearance === null ? null : appAppearanceSchema.parse(body.appearance);
        if (version === requestVersion.current && activeUser.current === userId) {
          setSnapshot({ userId, appearance: savedAppearance, ready: true, error: null });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && version === requestVersion.current && activeUser.current === userId) {
          setSnapshot((previous) => ({
            userId,
            appearance: previous.userId === userId ? previous.appearance : null,
            ready: false,
            error: "Could not load your theme. Try again."
          }));
        }
      });
    return () => controller.abort();
  }, [status, userId, reloadKey]);

  const save = useCallback(
    async (next: AppAppearance | null) => {
      if (!userId || !ready) throw new Error("Sign in and load your settings before saving.");
      const validated = next === null ? null : appAppearanceSchema.parse(next);
      const version = ++requestVersion.current;
      const response = await fetch("/api/settings/theme", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appearance: validated })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save your theme.");
      if (version !== requestVersion.current || activeUser.current !== userId)
        throw new Error("Your session changed. Reload your settings.");
      const savedAppearance = body.appearance === null ? null : appAppearanceSchema.parse(body.appearance);
      setSnapshot({ userId, appearance: savedAppearance, ready: true, error: null });
    },
    [ready, userId]
  );
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const error = snapshot.userId === userId ? snapshot.error : null;
  const value = useMemo(() => ({ appearance, ready, error, save, reload }), [appearance, ready, error, save, reload]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppAppearance() {
  const preferences = useContext(Context);
  if (!preferences) throw new Error("App appearance requires AppAppearanceProvider.");
  return preferences;
}
