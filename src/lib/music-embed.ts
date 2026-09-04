export type MusicProvider = "youtube" | "spotify" | "soundcloud" | "apple";

export type MusicSettings = {
  enabled: boolean;
  url: string;
  title: string;
};

export type MusicEmbed = {
  provider: MusicProvider;
  providerLabel: string;
  embedUrl: string;
  sourceUrl: string;
  aspect: "video" | "audio";
};

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  enabled: false,
  url: "",
  title: ""
};

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const SPOTIFY_TYPES = new Set(["track", "album", "playlist", "episode", "show", "artist"]);

export function resolveMusicEmbed(value: string): MusicEmbed | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be" || hostname === "youtube.com" || hostname === "music.youtube.com") {
    return resolveYoutubeEmbed(url, hostname);
  }
  if (hostname === "open.spotify.com") {
    return resolveSpotifyEmbed(url);
  }
  if (hostname === "soundcloud.com" || hostname.endsWith(".soundcloud.com")) {
    return {
      provider: "soundcloud",
      providerLabel: "SoundCloud",
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`,
      sourceUrl: url.toString(),
      aspect: "audio"
    };
  }
  if (hostname === "music.apple.com" || hostname === "embed.music.apple.com") {
    return {
      provider: "apple",
      providerLabel: "Apple Music",
      embedUrl: `https://embed.music.apple.com${url.pathname}${url.search}`,
      sourceUrl: url.toString(),
      aspect: "audio"
    };
  }

  return null;
}

export function normalizeMusicSettings(value: unknown): MusicSettings {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const url = typeof input.url === "string" ? input.url.trim().slice(0, 500) : "";
  return {
    enabled: input.enabled === true && Boolean(resolveMusicEmbed(url)),
    url,
    title: typeof input.title === "string" ? input.title.trim().slice(0, 100) : ""
  };
}

function resolveYoutubeEmbed(url: URL, hostname: string): MusicEmbed | null {
  const videoId = hostname === "youtu.be"
    ? url.pathname.split("/").filter(Boolean)[0]
    : url.searchParams.get("v") ?? (/^\/embed\//.test(url.pathname) ? url.pathname.split("/")[2] : null);
  const playlistId = url.searchParams.get("list");

  if (videoId && YOUTUBE_ID_PATTERN.test(videoId)) {
    const playlist = playlistId ? `&list=${encodeURIComponent(playlistId)}` : "";
    return {
      provider: "youtube",
      providerLabel: hostname === "music.youtube.com" ? "YouTube Music" : "YouTube",
      embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1&controls=1&rel=0${playlist}`,
      sourceUrl: url.toString(),
      aspect: "video"
    };
  }

  if (playlistId && /^[A-Za-z0-9_-]{8,80}$/.test(playlistId)) {
    return {
      provider: "youtube",
      providerLabel: hostname === "music.youtube.com" ? "YouTube Music" : "YouTube",
      embedUrl: `https://www.youtube.com/embed?playsinline=1&controls=1&listType=playlist&list=${encodeURIComponent(playlistId)}`,
      sourceUrl: url.toString(),
      aspect: "video"
    };
  }

  return null;
}

function resolveSpotifyEmbed(url: URL): MusicEmbed | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const offset = parts[0]?.startsWith("intl-") ? 1 : 0;
  const type = parts[offset];
  const id = parts[offset + 1];
  if (!type || !SPOTIFY_TYPES.has(type) || !id || !/^[A-Za-z0-9]+$/.test(id)) {
    return null;
  }

  return {
    provider: "spotify",
    providerLabel: "Spotify",
    embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
    sourceUrl: url.toString(),
    aspect: "audio"
  };
}
