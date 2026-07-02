import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("primary navigation uses desktop top island and mobile bottom island", async () => {
  const rail = await read("../src/components/nav/NavRail.tsx");
  const wrapper = await read("../src/components/layout/Sidebar.tsx");
  const shell = await read("../src/components/layout/AppShell.tsx");
  const styles = await read("../src/app/globals.css");
  const tokens = await read("../src/styles/design-tokens.css");

  assert.match(rail, /top-nav-island/);
  assert.match(rail, /const isChatSurface = pathname\.startsWith\("\/chat\/"\)/);
  assert.match(rail, /if \(isChatSurface\)[\s\S]*return null/);
  assert.match(rail, /fixed inset-x-0 top-4/);
  assert.match(rail, /hidden justify-center px-3 md:flex/);
  assert.match(rail, /mobile-nav-island/);
  assert.match(rail, /bottom-\[calc\(12px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(rail, /md:hidden/);
  assert.match(rail, /rounded-full/);
  assert.match(rail, /max-w-\[760px\]/);
  assert.match(rail, /\{ href: "\/rooms", label: "Rooms"/);
  assert.doesNotMatch(rail, /next\/image|Nythera home|src="\/icon\.svg"/);
  assert.doesNotMatch(rail, /bottom-0|inset-y-0 left-0|border-r|nythera-rail|rail-label/);
  assert.doesNotMatch(styles, /\.nythera-rail|\.rail-label/);
  assert.match(tokens, /--bottom-nav-offset:\s*calc\(92px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(wrapper, /return <NavRail \/>/);
  assert.match(shell, /id="app-shell"/);
  assert.match(shell, /fixed inset-0/);
  assert.match(shell, /const isChatSurface = pathname\.startsWith\("\/chat\/"\)/);
  assert.match(shell, /isChatSurface \? "pb-0 pt-0"/);
  assert.match(shell, /pb-\[var\(--bottom-nav-offset\)\]/);
  assert.match(shell, /pt-0 md:pb-0 md:pt-\[var\(--top-bar-height\)\]/);
  assert.doesNotMatch(shell, /md:pl-\[var\(--nav-rail-expanded\)\]/);
  assert.match(shell, /<SidePanel \/>/);
  assert.doesNotMatch(shell, /BottomNav|AuroraWebglBackground|sidebarCollapsed/);
});

test("global story context is a closable right-side drawer", async () => {
  const panel = await read("../src/components/panel/SidePanel.tsx");

  assert.match(panel, /Story context/);
  assert.match(panel, /PersonaTabContent/);
  assert.match(panel, /MemoryTabContent/);
  assert.match(panel, /HistoryTabContent/);
  assert.match(panel, /max-w-\[var\(--side-panel-width\)\]/);
  assert.match(panel, /fixed bottom-0 right-0/);
  assert.match(panel, /xl:top-\[var\(--top-bar-height\)\]/);
  assert.match(panel, /open && "translate-x-0"/);
  assert.match(panel, /Close side panel overlay/);
  assert.match(panel, /Hide side panel/);
  assert.doesNotMatch(panel, /!isChatSurface && "xl:translate-x-0"/);
  assert.doesNotMatch(panel, /!isChatSurface && "xl:hidden"/);
  assert.match(panel, /isChatSurface && "top-0 xl:top-0 xl:h-full"/);
  assert.match(panel, /setActivePersona/);
  assert.doesNotMatch(panel, /xl:static/);
  assert.doesNotMatch(panel, /ChatComposerSheet|<ChatQuickPanel/);
});
