import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveMusicEmbed } from "../src/lib/music-embed";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("primary navigation uses Account instead of the create shortcut", async () => {
  const navigation = await read("../src/components/nav/navigation-items.ts");

  assert.match(navigation, /href: "\/account", label: "Account"/);
  assert.doesNotMatch(navigation, /href: "\/create-character", label: "Create"/);
});

test("supported music links resolve to HTTPS embed endpoints", () => {
  const sources = [
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
    "https://soundcloud.com/artist/track",
    "https://music.apple.com/us/album/example/123456"
  ];

  for (const source of sources) {
    const embed = resolveMusicEmbed(source);
    assert.ok(embed);
    assert.match(embed.embedUrl, /^https:\/\//);
  }
  assert.equal(resolveMusicEmbed("javascript:alert(1)"), null);
  assert.equal(resolveMusicEmbed("http://open.spotify.com/track/example"), null);
});

test("music is configured for both chats and public profiles", async () => {
  const [chatEditor, chatClient, profileEditor, publicProfile] = await Promise.all([
    read("../src/components/chat/ChatAppearancePanel.tsx"),
    read("../src/components/chat/chat-client.tsx"),
    read("../src/components/account/account-hub-client.tsx"),
    read("../src/components/profile/public-profile-view.tsx")
  ]);

  assert.match(chatEditor, /YouTube Music, Spotify, SoundCloud, or Apple Music/);
  assert.match(chatClient, /<MusicEmbedPlayer/);
  assert.match(profileEditor, /Enable on public profile/);
  assert.match(publicProfile, /<MusicEmbedPlayer/);
});

test("mobile sessions avoid focus churn and PWA updates wait for consent", async () => {
  const [sessionProvider, worker, manifest] = await Promise.all([
    read("../src/components/providers/session-provider.tsx"),
    read("../public/sw.js"),
    read("../src/app/manifest.ts")
  ]);

  assert.match(sessionProvider, /refetchOnWindowFocus=\{false\}/);
  assert.match(sessionProvider, /refetchWhenOffline=\{false\}/);
  const installHandler = worker.slice(worker.indexOf('self.addEventListener("install"'), worker.indexOf('self.addEventListener("activate"'));
  assert.doesNotMatch(installHandler, /skipWaiting/);
  assert.match(worker, /event\.data\?\.type === "SKIP_WAITING"/);
  assert.match(manifest, /id: "\/"/);
  assert.match(manifest, /start_url: "\/"/);
  assert.doesNotMatch(manifest, /orientation:/);
});
