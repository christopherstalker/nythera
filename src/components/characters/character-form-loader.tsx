"use client";

import dynamic from "next/dynamic";
import type { CharacterFormInitialValue } from "@/lib/character-form-types";

type CharacterFormLoaderProps = {
  mode: "create" | "edit";
  initialValue?: CharacterFormInitialValue;
};

const CharacterForm = dynamic(
  () => import("@/components/characters/character-form").then((module) => module.CharacterForm),
  {
    loading: () => <CharacterFormSkeleton />
  }
);

export function CharacterFormLoader(props: CharacterFormLoaderProps) {
  return <CharacterForm {...props} />;
}

export function CharacterFormSkeleton() {
  return <div className="skeleton h-[620px]" />;
}
