import type { Transition } from "motion/react";

export const springSnappy = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.75
} satisfies Transition;

export const springSoft = {
  type: "spring",
  stiffness: 220,
  damping: 28,
  mass: 0.9
} satisfies Transition;

export const easeStandard = {
  duration: 0.22,
  ease: [0.2, 0, 0, 1]
} satisfies Transition;
