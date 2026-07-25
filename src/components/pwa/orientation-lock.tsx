"use client";

import { useEffect } from "react";

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait-primary") => Promise<void>;
};

export function OrientationLock() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    if (!standalone) {
      return;
    }

    const orientation = screen.orientation as LockableOrientation | undefined;
    if (!orientation?.lock) {
      return;
    }

    void orientation.lock("portrait-primary").catch(() => {
      // The manifest still requests portrait mode when the runtime denies the API lock.
    });
  }, []);

  return null;
}
