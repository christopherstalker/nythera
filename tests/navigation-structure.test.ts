import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("primary navigation uses a desktop codex rail and mobile dock", async () => {
  const rail = await read("../src/components/nav/NavRail.tsx");
  const dock = await read("../src/components/nav/MobileDock.tsx");
  const items = await read("../src/components/nav/navigation-items.ts");
  const wrapper = await read("../src/components/layout/Sidebar.tsx");
  const shell = await read("../src/components/layout/AppShell.tsx");
  const styles = await read("../src/app/globals.css");
  const tokens = await read("../src/styles/design-tokens.css");

  assert.match(rail, /codex-rail/);
  assert.match(rail, /fixed inset-y-0 left-0/);
  assert.match(rail, /w-\[var\(--codex-rail-width\)\]/);
  assert.match(dock, /codex-mobile-dock/);
  assert.doesNotMatch(dock, /fixed inset-x-0 bottom-0/);
  assert.match(dock, /relative z-50 grid/);
  assert.match(dock, /md:hidden/);
  assert.match(dock, /grid-cols-5/);
  assert.match(items, /\{ href: "\/rooms", label: "Rooms"/);
  assert.match(rail, /next\/image|src="\/icon\.svg"/);
  assert.doesNotMatch(styles, /\.nythera-rail|\.rail-label/);
  assert.match(tokens, /--bottom-nav-offset:\s*calc\(92px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(wrapper, /return <NavRail \/>/);
  assert.match(shell, /id="app-shell"/);
  assert.match(shell, /fixed inset-0/);
  assert.match(shell, /const isImmersiveSurface = isChatSurface \|\| isRoomSurface/);
  assert.match(shell, /md:pl-\[var\(--codex-rail-width\)\]/);
  assert.match(shell, /grid-rows-\[minmax\(0,1fr\)_auto\]/);
  assert.match(shell, /<MobileDock \/>/);
  assert.doesNotMatch(shell, /pb-\[calc\(var\(--codex-mobile-dock-height\)/);
  assert.match(shell, /<SidePanel \/>/);
  assert.doesNotMatch(shell, /BottomNav|AuroraWebglBackground|sidebarCollapsed/);
});

test("global story context is a closable right-side drawer", async () => {
  const panel = await read("../src/components/panel/SidePanel.tsx");

  assert.match(panel, /Story context/);
  assert.match(panel, /PersonaTabContent/);
  assert.match(panel, /CastTabContent/);
  assert.match(panel, /SceneTabContent/);
  assert.match(panel, /PlotTabContent/);
  assert.match(panel, /CanonTabContent/);
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
