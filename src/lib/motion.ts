import type { Transition } from "motion/react";

export const springSnappy = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.8
} satisfies Transition;

export const springSoft = {
  type: "spring",
  stiffness: 200,
  damping: 24,
  mass: 1
} satisfies Transition;

export const easeStandard = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1]
} satisfies Transition;
