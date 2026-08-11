"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import { ArrowUpRight, Camera, Check, Copy, ImagePlus, MessageCircle, Plus, Settings2, Share2, Sparkles, Type, UserRound, Wand2, X } from "lucide-react";
import { MusicEmbedPlayer } from "@/components/music/MusicEmbedPlayer";
import { PublicProfileView } from "@/components/profile/public-profile-view";
import { FormattedTextarea } from "@/components/rich-text/formatted-textarea";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PROFILE_SETTINGS,
  PROFILE_THEME_PRESETS,
  parseProfileSettings,
  publicProfileUrl,
  type ProfileSettings,
  type ProfileThemePreset
} from "@/lib/profile-settings";
import { resolveMusicEmbed } from "@/lib/music-embed";
import { cn } from "@/lib/utils";
import { PROFILE_CUSTOM_FONT_FAMILY } from "@/hooks/use-custom-font";
import { SETTINGS_SECTIONS } from "@/components/settings/settings-sections";

type Profile = {
  email: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  accentColor?: string | null;
  profileSettings?: ProfileSettings | null;
  role: string;
  ageVerified: boolean;
};

type StudioCharacter = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  visibility?: string;
  _count?: { chats: number };
};

const MAX_UPLOAD_BYTES = 4_000_000;
const MAX_IMAGE_DATA_URL_LENGTH = 185_000;
const SOCIAL_LINKS = ["twitter", "patreon", "discord"] as const;
const FONT_PRESETS = ["Inter", "Georgia", "Garamond", "Arial", "Courier New"];
const PROFILE_SURFACES = [
  { id: "glass", label: "Glass", description: "Layered translucent panels" },
  { id: "luminous", label: "Luminous", description: "Accent-lit cards and glow" },
  { id: "editorial", label: "Editorial", description: "Quieter, image-led surfaces" }
] as const;
const PROFILE_AVATAR_SHAPES = ["circle", "soft", "square"] as const;
const PROFILE_BANNER_HEIGHTS = ["compact", "cinematic", "immersive"] as const;
const fieldLabelClass = "grid gap-2 text-[10px] font-medium uppercase tracking-[.14em] text-[var(--text-muted)]";

export function AccountHubClient() {
  const { status: sessionStatus } = useSession();
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"profile" | "studio" | "settings">("profile");
  const [profileEditing, setProfileEditing] = useState(false);
  const [previewMode, setPreviewMode] = useState<"visitor" | "owner">("owner");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [characters, setCharacters] = useState<StudioCharacter[]>([]);
  const [username, setUsername] = useState("");
  const [avatarValue, setAvatarValue] = useState("");
  const [settings, setSettings] = useState<ProfileSettings>(DEFAULT_PROFILE_SETTINGS);
  const [accentColor, setAccentColor] = useState("#8F81F7");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingFont, setUploadingFont] = useState(false);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    void Promise.all([
      fetch("/api/profile").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/library").then((response) => (response.ok ? response.json() : null))
    ]).then(([profileBody, libraryBody]) => {
      if (profileBody?.profile) {
        setProfile(profileBody.profile);
        setUsername(profileBody.profile.username ?? "");
        setAvatarValue(profileBody.profile.avatarUrl ?? "");
        setBio(profileBody.profile.bio ?? "");
        setAccentColor(profileBody.profile.accentColor ?? "#8F81F7");
        setSettings(parseProfileSettings(profileBody.profile.profileSettings));
      }
      if (libraryBody?.mine) setCharacters(libraryBody.mine);
    });
  }, [sessionStatus]);

  const publicCharacters = useMemo(() => characters.filter((character) => character.visibility === "PUBLIC"), [characters]);

  function updateMusic(patch: Partial<NonNullable<ProfileSettings["music"]>>) {
    setSettings((current) => ({
      ...current,
      music: { ...(current.music ?? DEFAULT_PROFILE_SETTINGS.music!), ...patch }
    }));
  }

  async function shareProfile() {
    if (!username) return;
    const url = `${window.location.origin}${publicProfileUrl(username)}`;
    if (navigator.share) {
      await navigator.share({ title: `${username} on Nythera`, url }).catch(() => null);
    } else {
      await navigator.clipboard?.writeText(url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setAvatarValue(await optimizeImage(file, 512, 512));
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not prepare that image.");
    } finally {
      event.target.value = "";
    }
  }

  async function onBannerFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const bannerUrl = await optimizeImage(file, 1200, 420);
      setSettings((current) => ({ ...current, bannerUrl, useGradientBanner: false }));
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not prepare that image.");
    } finally {
      event.target.value = "";
    }
  }

  async function onFontFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (!/\.(?:woff2?|ttf|otf)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      setStatus("Use a WOFF2, WOFF, TTF, or OTF font up to 10 MB.");
      return;
    }

    setUploadingFont(true);
    setStatus("Uploading custom font...");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "profile-font.woff2";
      const blob = await upload(`profile-fonts/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/fonts/upload",
        clientPayload: JSON.stringify({ scope: "profile" }),
        contentType: file.type || "application/octet-stream"
      });
      setSettings((current) => ({ ...current, fontFamily: PROFILE_CUSTOM_FONT_FAMILY, fontUrl: blob.url }));
      setStatus("Custom profile font uploaded. Save the profile to publish it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not upload the font.");
    } finally {
      setUploadingFont(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, avatarUrl: avatarValue, bio, accentColor, profileSettings: settings, ageVerified: form.get("ageVerified") === "on" })
    });
    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not save profile.");
      return;
    }
    const body = await response.json();
    setProfile(body.profile);
    setSettings(parseProfileSettings(body.profile.profileSettings));
    setStatus("Profile saved.");
    setProfileEditing(false);
  }

  if (sessionStatus === "loading") return <div className="skeleton h-72 rounded-sm" />;
  if (sessionStatus === "unauthenticated") return <p className="px-5 py-10 text-sm text-[var(--text-secondary)]">Sign in to manage your account.</p>;

  return (
    <div className="pb-8">
      <header className="border-b border-[var(--codex-rule)] px-5 pb-6 pt-4 sm:px-0 sm:pt-0">
        <p className="max-w-full break-all text-2xl font-medium text-[var(--text-primary)] sm:text-3xl">{username || "Your account"}</p>
        <div className="mt-5 flex items-start gap-5 sm:items-end">
          <Avatar name={username || "N"} src={avatarValue} size="xl" className="h-28 w-28 sm:h-32 sm:w-32" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl">{username || "Complete your profile"}</h1>
            <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">{bio || "Build your public identity, publish characters, and give your worlds a soundtrack."}</p>
          </div>
        </div>

        <dl className="mt-6 grid max-w-sm grid-cols-2 gap-4">
          <AccountStat value={characters.length} label="characters" />
          <AccountStat value={publicCharacters.length} label="public" />
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => { setTab("profile"); setProfileEditing(true); }}><UserRound className="h-4 w-4" />Edit profile</Button>
          <Button type="button" variant="secondary" onClick={() => void shareProfile()} disabled={!username}>{copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}{copied ? "Copied" : "Share profile"}</Button>
          {username ? <Button asChild variant="ghost"><Link href={publicProfileUrl(username)} target="_blank">View public page</Link></Button> : null}
        </div>
      </header>

      <div className="sticky top-0 z-30 grid grid-cols-3 border-b border-[var(--codex-rule)] bg-[color:var(--codex-paper)]/95 px-5 backdrop-blur-sm sm:px-0" role="tablist" aria-label="Account sections">
        <AccountTab active={tab === "profile"} onClick={() => { setTab("profile"); setProfileEditing(false); }}><UserRound className="h-4 w-4" />Profile</AccountTab>
        <AccountTab active={tab === "studio"} onClick={() => { setTab("studio"); setProfileEditing(false); }}><Wand2 className="h-4 w-4" />Characters</AccountTab>
        <AccountTab active={tab === "settings"} onClick={() => { setTab("settings"); setProfileEditing(false); }}><Settings2 className="h-4 w-4" />Settings</AccountTab>
      </div>

      {tab === "profile" ? (
        profileEditing ? <div className="grid gap-8 px-5 pt-7 sm:px-0 xl:grid-cols-[minmax(320px,.85fr)_minmax(0,1.15fr)]">
          <form onSubmit={onSubmit} className="min-w-0 space-y-7">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--codex-rule)] pb-4">
              <div><p className="codex-kicker">Profile settings</p><h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Edit your public page</h2></div>
              <Button type="button" variant="ghost" onClick={() => { setProfileEditing(false); setStatus(null); }}><X className="h-4 w-4" />Close</Button>
            </div>
            <EditorSection title="Identity" description="The essentials visitors see first.">
              <div className="relative overflow-hidden border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-3">
                <div className={cn("relative overflow-hidden", settings.bannerHeight === "compact" ? "h-20" : settings.bannerHeight === "immersive" ? "h-40" : "h-28")} style={{ background: PROFILE_THEME_PRESETS[settings.themePreset ?? "midnight"].gradient }}>
                  {!settings.useGradientBanner && settings.bannerUrl ? <Image src={settings.bannerUrl} alt="Profile banner preview" fill className="object-cover" unoptimized /> : null}
                  <div className="absolute inset-0 bg-black/25" />
                </div>
                <div className="relative -mt-8 flex items-end justify-between gap-3 px-2">
                  <span className={cn("bg-[var(--codex-paper)] p-1", settings.avatarShape === "square" ? "rounded-md" : settings.avatarShape === "soft" ? "rounded-2xl" : "rounded-full")}><Avatar name={username || "N"} src={avatarValue} size="lg" className={cn("h-20 w-20", settings.avatarShape === "square" ? "rounded-sm" : settings.avatarShape === "soft" ? "rounded-xl" : "rounded-full")} /></span>
                  <div className="mb-1 flex gap-2">
                    <UploadControl label="Upload cover" icon={Camera} onChange={onBannerFile} />
                    <UploadControl label="Upload avatar" icon={ImagePlus} onChange={onAvatarFile} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 px-2 pb-1">
                  <Choice active={Boolean(settings.useGradientBanner)} onClick={() => setSettings((current) => ({ ...current, useGradientBanner: true }))}>Gradient</Choice>
                  {settings.bannerUrl ? <Choice active={!settings.useGradientBanner} onClick={() => setSettings((current) => ({ ...current, useGradientBanner: false }))}>Cover image</Choice> : null}
                  {avatarValue ? <Choice onClick={() => setAvatarValue("")}><X className="h-3.5 w-3.5" />Remove avatar</Choice> : null}
                </div>
              </div>
              <label className={fieldLabelClass}>Username<Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoComplete="username" /></label>
              <label className={fieldLabelClass}>Email<Input value={profile?.email ?? ""} disabled /></label>
              <label className={fieldLabelClass}>Bio<FormattedTextarea value={bio} onChange={setBio} maxLength={800} placeholder="Tell visitors about you and the worlds you create." previewLabel="Public bio preview" /></label>
            </EditorSection>

            <EditorSection title="Visual style" description="Control color, layout, and typography across your public page.">
              <label className={fieldLabelClass}>Accent color<div className="flex h-11 items-center gap-3 border border-[var(--codex-rule)] bg-[var(--bg-input)] px-3"><input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} className="h-7 w-10 cursor-pointer border-0 bg-transparent" /><span className="text-sm text-[var(--text-secondary)]">{accentColor.toUpperCase()}</span></div></label>
              <div className="grid gap-2"><span className={fieldLabelClass}>Theme preset</span><div className="grid grid-cols-2 gap-2">{(Object.keys(PROFILE_THEME_PRESETS) as ProfileThemePreset[]).map((preset) => <button key={preset} type="button" onClick={() => setSettings((current) => ({ ...current, themePreset: preset }))} className={cn("relative h-20 overflow-hidden border text-left", settings.themePreset === preset ? "border-[var(--codex-mint)]" : "border-[var(--codex-rule)]")} style={{ background: PROFILE_THEME_PRESETS[preset].gradient }}><span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-3 py-2 text-xs">{PROFILE_THEME_PRESETS[preset].label}{settings.themePreset === preset ? <Check className="h-3.5 w-3.5" /> : null}</span></button>)}</div></div>
              <div className="grid gap-2"><span className={fieldLabelClass}>Profile layout</span><div className="flex flex-wrap gap-2">{(["minimal", "showcase", "grid"] as const).map((layout) => <Choice key={layout} active={settings.layoutStyle === layout} onClick={() => setSettings((current) => ({ ...current, layoutStyle: layout }))}>{layout}</Choice>)}</div></div>
              <div className="grid gap-2">
                <span className={fieldLabelClass}>Surface treatment</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PROFILE_SURFACES.map((surface) => (
                    <button
                      key={surface.id}
                      type="button"
                      aria-pressed={settings.surfaceStyle === surface.id}
                      onClick={() => setSettings((current) => ({ ...current, surfaceStyle: surface.id }))}
                      className={cn(
                        "focus-ring min-h-24 rounded-[var(--radius-card)] border p-3 text-left transition",
                        settings.surfaceStyle === surface.id
                          ? "border-[var(--codex-mint)] bg-[color-mix(in_oklch,var(--codex-mint)_9%,transparent)]"
                          : "border-[var(--border-default)] bg-[var(--neo-glass-bg-subtle)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <span className="block text-sm font-semibold text-[var(--text-primary)]">{surface.label}</span>
                      <span className="mt-1 block text-xs normal-case leading-5 tracking-normal text-[var(--text-muted)]">{surface.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2"><span className={fieldLabelClass}>Avatar shape</span><div className="flex flex-wrap gap-2">{PROFILE_AVATAR_SHAPES.map((shape) => <Choice key={shape} active={settings.avatarShape === shape} onClick={() => setSettings((current) => ({ ...current, avatarShape: shape }))}>{shape}</Choice>)}</div></div>
                <div className="grid gap-2"><span className={fieldLabelClass}>Banner scale</span><div className="flex flex-wrap gap-2">{PROFILE_BANNER_HEIGHTS.map((height) => <Choice key={height} active={settings.bannerHeight === height} onClick={() => setSettings((current) => ({ ...current, bannerHeight: height }))}>{height}</Choice>)}</div></div>
              </div>
              <label className={fieldLabelClass}>Font family<select className="h-11 border border-[var(--codex-rule)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)]" value={settings.fontUrl || settings.fontFamily === PROFILE_CUSTOM_FONT_FAMILY ? "custom" : FONT_PRESETS.includes(settings.fontFamily ?? "") ? settings.fontFamily : "manual"} onChange={(event) => { if (event.target.value === "custom") { setSettings((current) => ({ ...current, fontFamily: PROFILE_CUSTOM_FONT_FAMILY })); fontInputRef.current?.click(); } else { setSettings((current) => event.target.value === "manual" ? { ...current, fontUrl: "" } : { ...current, fontFamily: event.target.value, fontUrl: "" }); } }}>{FONT_PRESETS.map((font) => <option key={font}>{font}</option>)}<option value="custom">Custom uploaded font</option><option value="manual">Installed font name</option></select><Input value={settings.fontUrl ? "" : settings.fontFamily ?? "Inter"} onChange={(event) => setSettings((current) => ({ ...current, fontFamily: event.target.value, fontUrl: "" }))} maxLength={120} disabled={Boolean(settings.fontUrl)} /></label>
              <label className="focus-ring flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-dashed border-[var(--codex-rule)] px-4 text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-secondary)] hover:border-[var(--codex-mint)] hover:text-[var(--codex-mint)]"><Type className="h-4 w-4" />{uploadingFont ? "Uploading font..." : settings.fontUrl ? "Replace custom font" : "Upload custom font"}<input ref={fontInputRef} type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" className="sr-only" disabled={uploadingFont} onChange={(event) => void onFontFile(event)} /></label>
              <label className={fieldLabelClass}>Font scale · {(settings.fontScale ?? 1).toFixed(2)}<input type="range" min="0.85" max="1.3" step="0.05" value={settings.fontScale ?? 1} onChange={(event) => setSettings((current) => ({ ...current, fontScale: Number(event.target.value) }))} className="w-full accent-[var(--codex-mint)]" /></label>
            </EditorSection>

            <EditorSection title="Soundtrack" description="Use a public link from YouTube Music, Spotify, SoundCloud, or Apple Music. Visitors choose when playback starts.">
              <label className="flex items-center justify-between border border-[var(--codex-rule)] px-3 py-3 text-sm text-[var(--text-secondary)]">Enable on public profile<input type="checkbox" checked={settings.music?.enabled ?? false} onChange={(event) => updateMusic({ enabled: event.target.checked })} className="h-4 w-4 accent-[var(--codex-mint)]" /></label>
              <label className={fieldLabelClass}>Track or playlist URL<Input type="url" inputMode="url" value={settings.music?.url ?? ""} onChange={(event) => updateMusic({ url: event.target.value })} placeholder="https://music.youtube.com/watch?v=..." /></label>
              <label className={fieldLabelClass}>Display title<Input value={settings.music?.title ?? ""} onChange={(event) => updateMusic({ title: event.target.value })} placeholder="My profile soundtrack" maxLength={100} /></label>
              {settings.music?.url ? <p className={cn("text-xs", resolveMusicEmbed(settings.music.url) ? "text-emerald-300" : "text-amber-300")}>{resolveMusicEmbed(settings.music.url)?.providerLabel ?? "This link is not supported."}</p> : null}
              <MusicEmbedPlayer music={settings.music} />
            </EditorSection>

            <EditorSection title="Links & access" description="Connect the places where your audience can find you.">
              {SOCIAL_LINKS.map((key) => <label key={key} className={fieldLabelClass}>{key}<Input type="url" inputMode="url" value={settings.socialLinks?.[key] ?? ""} onChange={(event) => setSettings((current) => ({ ...current, socialLinks: { ...current.socialLinks, [key]: event.target.value } }))} placeholder={`${key[0].toUpperCase()}${key.slice(1)} URL`} /></label>)}
              <label className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]"><input name="ageVerified" type="checkbox" defaultChecked={profile?.ageVerified ?? false} className="mt-1 accent-[var(--codex-mint)]" />I confirm I can access age-gated content settings.</label>
            </EditorSection>

            <div className="sticky bottom-[calc(var(--codex-mobile-dock-height)+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-3 border border-[var(--codex-rule)] bg-[var(--codex-paper)] p-3 md:bottom-3">
              <Button type="submit" disabled={saving || uploadingFont}>{saving ? "Saving…" : uploadingFont ? "Uploading font…" : "Save profile"}</Button>
              {status ? <p className="text-sm text-[var(--text-secondary)]" role="status">{status}</p> : null}
            </div>
          </form>

          <div className="min-w-0 space-y-3 xl:sticky xl:top-6 xl:self-start">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--codex-rule)] pb-3"><p className="codex-kicker">Live preview</p><div className="flex gap-2"><Choice active={previewMode === "owner"} onClick={() => setPreviewMode("owner")}>Owner</Choice><Choice active={previewMode === "visitor"} onClick={() => setPreviewMode("visitor")}>Visitor</Choice></div></div>
            <PublicProfileView username={username || "username"} bio={bio} avatarUrl={avatarValue} accentColor={accentColor} settings={settings} characters={publicCharacters} isOwner previewMode={previewMode} />
          </div>
        </div> : <div className="px-0 pt-7 sm:px-0"><PublicProfileView username={username || "username"} bio={bio} avatarUrl={avatarValue} accentColor={accentColor} settings={settings} characters={publicCharacters} isOwner previewMode="owner" /></div>
      ) : tab === "studio" ? <div className="px-5 pt-7 sm:px-0"><CharacterStudio characters={characters} /></div> : <MobileSettingsIndex />}
    </div>
  );
}

function AccountTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn("focus-ring flex h-14 items-center justify-center gap-2 border-b-2 text-xs font-medium uppercase tracking-[.12em]", active ? "border-[var(--codex-mint)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]")}>{children}</button>;
}

function AccountStat({ value, label }: { value: number; label: string }) {
  return <div><dt className="text-xl font-medium tabular-nums text-[var(--text-primary)]">{value}</dt><dd className="mt-1 text-xs text-[var(--text-muted)]">{label}</dd></div>;
}

function EditorSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-b border-[var(--codex-rule)] pb-7"><div><h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</p></div>{children}</section>;
}

function UploadControl({ label, icon: Icon, onChange }: { label: string; icon: typeof Camera; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <label className="focus-ring grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[var(--codex-rule)] bg-[var(--codex-paper)] text-[var(--text-secondary)] hover:text-[var(--codex-mint)]" title={label}><Icon className="h-4 w-4" /><span className="sr-only">{label}</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onChange} /></label>;
}

function Choice({ active = false, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs capitalize", active ? "border-[var(--codex-mint)] text-[var(--codex-mint)]" : "border-[var(--codex-rule)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]")}>{children}</button>;
}

function CharacterStudio({ characters }: { characters: StudioCharacter[] }) {
  return <section className="space-y-5" aria-labelledby="character-studio-title"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="codex-kicker">Your collection</p><h2 id="character-studio-title" className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">My characters</h2></div><Button asChild size="lg"><Link href="/create-character"><Sparkles className="h-4 w-4" />Create character</Link></Button></div>{characters.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{characters.map((character) => <article key={character.id} className="group flex min-h-52 flex-col border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-5 transition-transform motion-safe:hover:-translate-y-1"><div className="flex items-center gap-4"><Avatar name={character.name} src={character.avatarUrl} size="lg" className="h-20 w-20" /><div className="min-w-0 flex-1"><h3 className="truncate text-lg font-semibold text-[var(--text-primary)]">{character.name}</h3><span className="mt-2 inline-flex rounded-full border border-[var(--codex-rule)] px-2.5 py-1 text-[10px] uppercase tracking-[.12em] text-[var(--text-muted)]">{character.visibility?.toLowerCase() ?? "draft"}</span></div></div><p className="mt-4 line-clamp-2 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{character.description || "A new character waiting for their story."}</p><div className="mt-5 flex items-center gap-2 border-t border-[var(--codex-rule)] pt-4"><span className="mr-auto inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><MessageCircle className="h-3.5 w-3.5" />{character._count?.chats ?? 0}</span><Button asChild variant="outline" size="sm"><Link href={`/character/${character.id}`}>View</Link></Button><Button asChild size="sm"><Link href={`/character/${character.id}/edit`}>Edit</Link></Button></div></article>)}</div> : <div className="flex flex-col items-center border border-dashed border-[var(--codex-rule)] px-6 py-16 text-center"><div className="grid h-20 w-20 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--codex-mint)]"><Wand2 className="h-8 w-8" /></div><h3 className="mt-6 text-xl font-semibold text-[var(--text-primary)]">No characters yet</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">Create your first character and shape their personality, voice, and world.</p><Button asChild className="mt-6"><Link href="/create-character"><Plus className="h-4 w-4" />Create character</Link></Button></div>}</section>;
}

function MobileSettingsIndex() {
  return (
    <section className="px-5 pt-7 sm:px-0" aria-labelledby="mobile-settings-title">
      <p className="codex-kicker">Account control center</p>
      <h2 id="mobile-settings-title" className="mt-2 font-editorial text-4xl text-[var(--text-primary)]">All settings</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Every desktop setting is available here in the mobile and installed app experience.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href} className="glass-card group flex min-h-28 items-start gap-4 p-4 no-underline transition-colors hover:border-[var(--codex-mint)]/45">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--accent-violet)] group-hover:text-[var(--codex-mint)]"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--text-primary)]">{section.label}<ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" /></span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{section.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

async function optimizeImage(file: File, maxWidth: number, maxHeight: number) {
  if (!file.type.startsWith("image/") || file.size > MAX_UPLOAD_BYTES) throw new Error("Choose a PNG, JPG, or WebP image smaller than 4MB.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("That image could not be read."));
      image.src = objectUrl;
    });
    const baseScale = Math.min(1, maxWidth / source.naturalWidth, maxHeight / source.naturalHeight);
    for (const dimensionScale of [1, 0.82, 0.68]) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.naturalWidth * baseScale * dimensionScale));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * baseScale * dimensionScale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable in this browser.");
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.68, 0.52, 0.38]) {
        const dataUrl = canvas.toDataURL("image/webp", quality);
        if (dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) return dataUrl;
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  throw new Error("That image is too detailed to use. Try a smaller crop.");
}
