import {
  Books,
  Compass,
  House,
  Plus,
  UsersThree
} from "@phosphor-icons/react";

export const primaryNavigationItems = [
  { href: "/", label: "Home", icon: House },
  { href: "/explore", label: "Discover", icon: Compass },
  { href: "/library", label: "Library", icon: Books },
  { href: "/rooms", label: "Rooms", icon: UsersThree },
  { href: "/create-character", label: "Create", icon: Plus }
] as const;

export type NavigationIcon = (typeof primaryNavigationItems)[number]["icon"];

export function isNavigationItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
