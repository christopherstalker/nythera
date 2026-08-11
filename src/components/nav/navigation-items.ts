import {
  Books,
  Compass,
  GearSix,
  Heart,
  House,
  Question,
  UserCircle,
  UsersThree
} from "@phosphor-icons/react";
import { PATREON_SUPPORT_URL } from "@/lib/support";

export const primaryNavigationItems = [
  { href: "/", label: "Home", icon: House },
  { href: "/explore", label: "Discover", icon: Compass },
  { href: "/library", label: "Library", icon: Books },
  { href: "/rooms", label: "Rooms", icon: UsersThree },
  { href: "/account", label: "Account", icon: UserCircle }
] as const;

export const utilityNavigationItems = [
  { href: "/guide", label: "Help", icon: Question, external: false, support: false },
  { href: PATREON_SUPPORT_URL, label: "Patreon", icon: Heart, external: true, support: true },
  { href: "/settings", label: "Settings", icon: GearSix, external: false, support: false }
] as const;

export type NavigationIcon =
  | (typeof primaryNavigationItems)[number]["icon"]
  | (typeof utilityNavigationItems)[number]["icon"];

export function isNavigationItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
