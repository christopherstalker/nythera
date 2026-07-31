import {
  Books,
  Compass,
  GearSix,
  House,
  Plus,
  Question,
  UsersThree
} from "@phosphor-icons/react";

export const primaryNavigationItems = [
  { href: "/", label: "Home", icon: House },
  { href: "/explore", label: "Discover", icon: Compass },
  { href: "/library", label: "Library", icon: Books },
  { href: "/rooms", label: "Rooms", icon: UsersThree },
  { href: "/create-character", label: "Create", icon: Plus }
] as const;

export const utilityNavigationItems = [
  { href: "/guide", label: "Help", icon: Question },
  { href: "/settings", label: "Settings", icon: GearSix }
] as const;

export type NavigationIcon =
  | (typeof primaryNavigationItems)[number]["icon"]
  | (typeof utilityNavigationItems)[number]["icon"];

export function isNavigationItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
