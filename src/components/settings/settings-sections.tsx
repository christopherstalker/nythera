import {
  BookOpen,
  Brain,
  Eye,
  KeyRound,
  Mic2,
  UserCog,
  UserRound,
  type LucideIcon
} from "lucide-react";

export type SettingsSection = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  legacyHash?: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    href: "/settings/account",
    label: "Account",
    description: "Profile, avatar, bio, and age-gated access.",
    icon: UserCog
  },
  {
    href: "/settings/personas",
    label: "Personas",
    description: "Choose how you appear inside character chats.",
    icon: UserRound,
    legacyHash: "persona"
  },
  {
    href: "/settings/providers",
    label: "Model providers",
    description: "API keys, OpenRouter, custom endpoints, and fallback order.",
    icon: KeyRound,
    legacyHash: "api-keys"
  },
  {
    href: "/settings/voice",
    label: "Voice",
    description: "Text-to-speech providers and default voices.",
    icon: Mic2
  },
  {
    href: "/settings/interface",
    label: "Interface",
    description: "Chat density and the permanent Living Codex theme.",
    icon: Eye,
    legacyHash: "interface"
  },
  {
    href: "/settings/memory",
    label: "Memory & privacy",
    description: "Control saved memories and what chats may remember.",
    icon: Brain,
    legacyHash: "privacy"
  },
  {
    href: "/settings/help",
    label: "Help & support",
    description: "Manuals, API guidance, and contact options.",
    icon: BookOpen,
    legacyHash: "help"
  }
];

export function getSettingsSection(href: string) {
  return SETTINGS_SECTIONS.find((section) => section.href === href);
}
