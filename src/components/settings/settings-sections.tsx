import { BookOpen, Brain, Eye, KeyRound, Mic2, UserCog, UserRound, type LucideIcon } from "lucide-react";

export type SettingsSection = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "Your identity" | "Conversations" | "Help";
  legacyHash?: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    href: "/account",
    label: "Account",
    description: "Profile, avatar, bio, and age-gated access.",
    icon: UserCog,
    group: "Your identity"
  },
  {
    href: "/settings/personas",
    label: "Personas",
    description: "Choose how you appear inside character chats.",
    icon: UserRound,
    group: "Your identity",
    legacyHash: "persona"
  },
  {
    href: "/settings/providers",
    label: "Model providers",
    description: "API keys, OpenRouter, custom endpoints, and fallback order.",
    icon: KeyRound,
    group: "Conversations",
    legacyHash: "api-keys"
  },
  {
    href: "/settings/voice",
    label: "Voice",
    description: "Text-to-speech providers and default voices.",
    icon: Mic2,
    group: "Conversations"
  },
  {
    href: "/settings/interface",
    label: "Interface",
    description: "Message spacing, chat density and reading preferences.",
    icon: Eye,
    group: "Conversations",
    legacyHash: "interface"
  },
  {
    href: "/settings/memory",
    label: "Memory & privacy",
    description: "Control saved memories and what chats may remember.",
    icon: Brain,
    group: "Conversations",
    legacyHash: "privacy"
  },
  {
    href: "/settings/help",
    label: "Help & support",
    description: "Manuals, API guidance, and contact options.",
    icon: BookOpen,
    group: "Help",
    legacyHash: "help"
  }
];

export function getSettingsSection(href: string) {
  return SETTINGS_SECTIONS.find((section) => section.href === href);
}
