import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("desktop navigation is a floating overlay rail with separate utility drawers", async () => {
  const sidebar = await read("../src/components/layout/Sidebar.tsx");
  const shell = await read("../src/components/layout/AppShell.tsx");

  assert.match(sidebar, /nythera-rail/);
  assert.match(sidebar, /bottom-4 left-4 top-4/);
  assert.match(sidebar, /hover:w-\[236px\]/);
  assert.match(sidebar, /type UtilityView = "search" \| "chats" \| null/);
  assert.match(sidebar, /left-\[100px\][\s\S]*Recent chats/);
  assert.doesNotMatch(sidebar, /Collapse sidebar|toggleSidebar|sidebarCollapsed/);
  assert.match(shell, /md:pl-\[96px\]/);
  assert.doesNotMatch(shell, /sidebarCollapsed|lg:pl-\[var\(--sidebar-width\)\]/);
});

test("utility drawer locks the rail to its compact footprint", async () => {
  const sidebar = await read("../src/components/layout/Sidebar.tsx");
  const styles = await read("../src/app/globals.css");

  assert.match(sidebar, /utilityView \? "rail-locked"/);
  assert.match(styles, /nythera-rail:not\(\.rail-locked\):hover/);
});
