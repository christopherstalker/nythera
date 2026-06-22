"use client";

import { useReducedMotion } from "motion/react";

export function usePrefersReducedMotion() {
  return useReducedMotion() ?? true;
}
