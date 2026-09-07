"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import {
  ArrowUpRight,
  Camera,
  Eye,
  ChevronDown,
  Check,
  Copy,
  ImagePlus,
  MessageCircle,
  Plus,
  Settings2,
  Share2,
  Sparkles,
  Type,
  UserRound,
  Wand2,
  X
} from "lucide-react";
import { MusicEmbedPlayer } from "@/components/music/MusicEmbedPlayer";
import { PublicProfileView } from "@/components/profile/public-profile-view";
import { UsernameField } from "@/components/profile/username-field";
import { FormattedTextarea } from "@/components/rich-text/formatted-textarea";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
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
import { AccountPasswordClient } from "@/components/settings/account-password-client";

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
const FONT_PRESETS = ["Lora", "Inter", "Georgia", "Garamond", "Arial", "Courier New"];
const PROFILE_SURFACES = [
  { id: "glass", label: "Glass", description: "Layered translucent panels" },
  { id: "luminous", label: "Luminous", description: "Accent-lit cards and glow" },
  { id: "editorial", label: "Editorial", description: "Quieter, image-led surfaces" }
] as const;
const PROFILE_AVATAR_SHAPES = ["circle", "soft", "square"] as const;
const PROFILE_BANNER_HEIGHTS = ["compact", "cinematic", "immersive"] as const;
const fieldLabelClass = "grid gap-2 text-sm font-medium text-[var(--text-secondary)]";
type AccountTabId = "profile" | "studio" | "settings";

export function AccountHubClient() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fontInputRef = useRef<HTMLInputElement>(null);
  const tab = parseAccountTab(searchParams.get("tab"));
  const [profileEditing, setProfileEditing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const [profileLoading, setProfileLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [ageVerified, setAgeVerified] = useState(false);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    setProfileLoading(true);
    setLoadError(false);
    void Promise.all([
      fetch("/api/profile").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/library").then((response) => (response.ok ? response.json() : null))
    ])
      .then(([profileBody, libraryBody]) => {
        if (!profileBody?.profile || !libraryBody) throw new Error();
        if (profileBody?.profile) {
          setProfile(profileBody.profile);
          setAgeVerified(Boolean(profileBody.profile.ageVerified));
          setUsername(profileBody.profile.username ?? "");
          setAvatarValue(profileBody.profile.avatarUrl ?? "");
          setBio(profileBody.profile.bio ?? "");
          setAccentColor(profileBody.profile.accentColor ?? "#8F81F7");
          setSettings(parseProfileSettings(profileBody.profile.profileSettings));
        }
        if (libraryBody?.mine) setCharacters(libraryBody.mine);
      })
      .catch(() => setLoadError(true))
      .finally(() => setProfileLoading(false));
  }, [sessionStatus, loadAttempt]);

  const publicCharacters = useMemo(
    () => characters.filter((character) => character.visibility === "PUBLIC"),
    [characters]
  );
  const hasProfileChanges =
    Boolean(profile) &&
    (username !== (profile?.username ?? "") ||
      avatarValue !== (profile?.avatarUrl ?? "") ||
      bio !== (profile?.bio ?? "") ||
      accentColor !== (profile?.accentColor ?? "#8F81F7") ||
      ageVerified !== Boolean(profile?.ageVerified) ||
      JSON.stringify(settings) !== JSON.stringify(parseProfileSettings(profile?.profileSettings)));

  function discardProfileChanges() {
    if (saving || uploadingFont) return false;
    if (hasProfileChanges && !window.confirm("Discard your unsaved profile changes?")) return false;
    setUsername(profile?.username ?? "");
    setAvatarValue(profile?.avatarUrl ?? "");
    setBio(profile?.bio ?? "");
    setAccentColor(profile?.accentColor ?? "#8F81F7");
    setSettings(parseProfileSettings(profile?.profileSettings));
    setAgeVerified(Boolean(profile?.ageVerified));
    setProfileEditing(false);
    setStatus(null);
    return true;
  }

  useEffect(() => {
    if (!profileEditing || !hasProfileChanges) return;
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function confirmNavigation(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (saving || uploadingFont || !window.confirm("Discard your unsaved profile changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", confirmNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", confirmNavigation, true);
    };
  }, [profileEditing, hasProfileChanges, saving, uploadingFont]);

  function selectTab(nextTab: AccountTabId, editProfile = false) {
    if (profileEditing && !discardProfileChanges()) return;
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "profile") params.delete("tab");
    else params.set("tab", nextTab);
    router.replace(params.size > 0 ? `/account?${params}` : "/account", { scroll: false });
    setProfileEditing(editProfile);
  }

  function updateMusic(patch: Partial<NonNullable<ProfileSettings["music"]>>) {
    setSettings((current) => ({
      ...current,
      music: { ...(current.music ?? DEFAULT_PROFILE_SETTINGS.music!), ...patch }
    }));
  }

  async function shareProfile() {
    if (!username) return;
    const url = `${window.location.origin}${publicProfileUrl(username)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${username} on Nythera`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setStatus("Could not share your profile. Open the public profile to copy its address.");
    }
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
    if (saving || uploadingFont) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          avatarUrl: avatarValue,
          bio,
          accentColor,
          profileSettings: settings,
          ageVerified
        })
      });
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
      window.dispatchEvent(new CustomEvent("nythera:profile-updated", { detail: { profile: body.profile } }));
    } catch {
      setStatus("Could not save profile. Your changes are still here; please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionStatus === "loading") return <div className="skeleton h-72 rounded-sm" />;
  if (sessionStatus === "unauthenticated")
    return <p className="px-5 py-10 text-sm text-[var(--text-secondary)]">Sign in to manage your account.</p>;
  if (profileLoading) return <div role="status" aria-label="Loading profile" className="skeleton h-72 rounded-xl" />;
  if (loadError)
    return (
      <div role="alert" className="space-y-4 p-6">
        <p>Could not load your account. Please try again.</p>
        <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</Button>
      </div>
    );

  return (
    <div className="account-workspace min-w-0 max-w-full pb-8" data-editing={profileEditing}>
      <PageHeader compact title="Account" description="Your identity, your characters, your corner of Nythera." />
      <section className="account-identity" aria-label="Your profile">
        <Avatar name={profile?.username || "N"} src={profile?.avatarUrl} size="xl" className="account-avatar" />
        <div className="account-identity-copy">
          <h2>{profile?.username || "Make yourself at home"}</h2>
          <p>{profile?.username ? `@${profile.username}` : "Choose a username to create your public page."}</p>
        </div>
        <dl className="account-stats">
          <AccountStat value={characters.length} label="Characters" />
          <AccountStat value={publicCharacters.length} label="Public" />
        </dl>
        <div className="account-identity-actions">
          {!profileEditing ? (
            <Button type="button" variant="secondary" onClick={() => selectTab("profile", true)}>
              <UserRound className="h-4 w-4" />
              Edit profile
            </Button>
          ) : null}
          {profile?.username ? (
            <Button asChild variant="ghost">
              <Link href={publicProfileUrl(profile.username)} target="_blank">
                Public page <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>
      <div className="account-navigation" role="tablist" aria-label="Account sections">
        <AccountTab id="profile" active={tab === "profile"} onClick={() => selectTab("profile")}>
          <UserRound className="h-4 w-4" />
          {profileEditing ? "Profile editor" : "Overview"}
        </AccountTab>
        <AccountTab id="studio" active={tab === "studio"} onClick={() => selectTab("studio")}>
          <Wand2 className="h-4 w-4" />
          Characters <span className="account-tab-count">{characters.length}</span>
        </AccountTab>
        <AccountTab id="settings" active={tab === "settings"} onClick={() => selectTab("settings")}>
          <Settings2 className="h-4 w-4" />
          Account & access
        </AccountTab>
      </div>
      <div
        role="tabpanel"
        id={`account-panel-${tab}`}
        aria-labelledby={`account-tab-${tab}`}
        tabIndex={0}
        className="account-tabpanel focus-ring"
      >
        {tab === "profile" ? (
          profileEditing ? (
            <div className="account-editor">
              <form
                onSubmit={onSubmit}
                onInvalidCapture={(event) => {
                  const section = (event.target as HTMLElement).closest("details");
                  if (section) section.open = true;
                }}
                className="account-editor-form"
              >
                <fieldset disabled={saving || uploadingFont} className="min-w-0">
                  <div className="account-section-title">
                    <div>
                      <p className="codex-kicker">Public identity</p>
                      <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Edit your public page</h2>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={saving || uploadingFont}
                      onClick={discardProfileChanges}
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                  <EditorSection title="Identity" description="Name, portrait, cover and bio." initiallyOpen>
                    <div className="relative overflow-hidden border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-3">
                      <div
                        className={cn(
                          "relative overflow-hidden",
                          settings.bannerHeight === "compact"
                            ? "h-20"
                            : settings.bannerHeight === "immersive"
                              ? "h-40"
                              : "h-28"
                        )}
                        style={{ background: PROFILE_THEME_PRESETS[settings.themePreset ?? "midnight"].gradient }}
                      >
                        {!settings.useGradientBanner && settings.bannerUrl ? (
                          <Image
                            src={settings.bannerUrl}
                            alt="Profile banner preview"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-black/25" />
                      </div>
                      <div className="relative -mt-8 flex items-end justify-between gap-3 px-2">
                        <span
                          className={cn(
                            "bg-[var(--codex-paper)] p-1",
                            settings.avatarShape === "square"
                              ? "rounded-md"
                              : settings.avatarShape === "soft"
                                ? "rounded-2xl"
                                : "rounded-full"
                          )}
                        >
                          <Avatar
                            name={username || "N"}
                            src={avatarValue}
                            size="lg"
                            className={cn(
                              "h-20 w-20",
                              settings.avatarShape === "square"
                                ? "rounded-sm"
                                : settings.avatarShape === "soft"
                                  ? "rounded-xl"
                                  : "rounded-full"
                            )}
                          />
                        </span>
                        <div className="mb-1 flex gap-2">
                          <UploadControl label="Upload cover" icon={Camera} onChange={onBannerFile} />
                          <UploadControl label="Upload avatar" icon={ImagePlus} onChange={onAvatarFile} />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 px-2 pb-1">
                        <Choice
                          active={Boolean(settings.useGradientBanner)}
                          onClick={() => setSettings((current) => ({ ...current, useGradientBanner: true }))}
                        >
                          Gradient
                        </Choice>
                        {settings.bannerUrl ? (
                          <Choice
                            active={!settings.useGradientBanner}
                            onClick={() => setSettings((current) => ({ ...current, useGradientBanner: false }))}
                          >
                            Cover image
                          </Choice>
                        ) : null}
                        {avatarValue ? (
                          <Choice onClick={() => setAvatarValue("")}>
                            <X className="h-3.5 w-3.5" />
                            Remove avatar
                          </Choice>
                        ) : null}
                      </div>
                    </div>
                    <label className={fieldLabelClass}>
                      Username
                      <UsernameField
                        id="account-username"
                        value={username}
                        onChange={setUsername}
                        currentUsername={profile?.username}
                      />
                    </label>
                    <label className={fieldLabelClass}>
                      Email
                      <Input value={profile?.email ?? ""} disabled />
                    </label>
                    <div className={fieldLabelClass}>
                      <label htmlFor="profile-bio">Bio</label>
                      <FormattedTextarea
                        id="profile-bio"
                        value={bio}
                        onChange={setBio}
                        maxLength={800}
                        placeholder="Tell visitors about you and the worlds you create."
                        previewLabel="Public bio preview"
                      />
                    </div>
                  </EditorSection>

                  <EditorSection
                    title="Visual style"
                    description="Control color, layout, and typography across your public page."
                  >
                    <label className={fieldLabelClass}>
                      Accent color
                      <div className="flex h-11 items-center gap-3 border border-[var(--codex-rule)] bg-[var(--bg-input)] px-3">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(event) => setAccentColor(event.target.value)}
                          className="h-7 w-10 cursor-pointer border-0 bg-transparent"
                        />
                        <span className="text-sm text-[var(--text-secondary)]">{accentColor.toUpperCase()}</span>
                      </div>
                    </label>
                    <div className="grid gap-2">
                      <span className={fieldLabelClass}>Theme preset</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(PROFILE_THEME_PRESETS) as ProfileThemePreset[]).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setSettings((current) => ({ ...current, themePreset: preset }))}
                            className={cn(
                              "relative h-20 overflow-hidden border text-left",
                              settings.themePreset === preset
                                ? "border-[var(--codex-mint)]"
                                : "border-[var(--codex-rule)]"
                            )}
                            style={{ background: PROFILE_THEME_PRESETS[preset].gradient }}
                          >
                            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-3 py-2 text-xs">
                              {PROFILE_THEME_PRESETS[preset].label}
                              {settings.themePreset === preset ? <Check className="h-3.5 w-3.5" /> : null}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <span className={fieldLabelClass}>Profile layout</span>
                      <div className="flex flex-wrap gap-2">
                        {(["minimal", "showcase", "grid"] as const).map((layout) => (
                          <Choice
                            key={layout}
                            active={settings.layoutStyle === layout}
                            onClick={() => setSettings((current) => ({ ...current, layoutStyle: layout }))}
                          >
                            {layout}
                          </Choice>
                        ))}
                      </div>
                    </div>
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
                            <span className="block text-sm font-semibold text-[var(--text-primary)]">
                              {surface.label}
                            </span>
                            <span className="mt-1 block text-xs normal-case leading-5 tracking-normal text-[var(--text-muted)]">
                              {surface.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <span className={fieldLabelClass}>Avatar shape</span>
                        <div className="flex flex-wrap gap-2">
                          {PROFILE_AVATAR_SHAPES.map((shape) => (
                            <Choice
                              key={shape}
                              active={settings.avatarShape === shape}
                              onClick={() => setSettings((current) => ({ ...current, avatarShape: shape }))}
                            >
                              {shape}
                            </Choice>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <span className={fieldLabelClass}>Banner scale</span>
                        <div className="flex flex-wrap gap-2">
                          {PROFILE_BANNER_HEIGHTS.map((height) => (
                            <Choice
                              key={height}
                              active={settings.bannerHeight === height}
                              onClick={() => setSettings((current) => ({ ...current, bannerHeight: height }))}
                            >
                              {height}
                            </Choice>
                          ))}
                        </div>
                      </div>
                    </div>
                    <label className={fieldLabelClass}>
                      Font family
                      <select
                        className="h-11 border border-[var(--codex-rule)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)]"
                        value={
                          settings.fontUrl || settings.fontFamily === PROFILE_CUSTOM_FONT_FAMILY
                            ? "custom"
                            : FONT_PRESETS.includes(settings.fontFamily ?? "")
                              ? settings.fontFamily
                              : "manual"
                        }
                        onChange={(event) => {
                          if (event.target.value === "custom") {
                            setSettings((current) => ({ ...current, fontFamily: PROFILE_CUSTOM_FONT_FAMILY }));
                            fontInputRef.current?.click();
                          } else {
                            setSettings((current) =>
                              event.target.value === "manual"
                                ? { ...current, fontUrl: "" }
                                : { ...current, fontFamily: event.target.value, fontUrl: "" }
                            );
                          }
                        }}
                      >
                        {FONT_PRESETS.map((font) => (
                          <option key={font}>{font}</option>
                        ))}
                        <option value="custom">Custom uploaded font</option>
                        <option value="manual">Installed font name</option>
                      </select>
                      <Input
                        value={settings.fontUrl ? "" : (settings.fontFamily ?? "Inter")}
                        onChange={(event) =>
                          setSettings((current) => ({ ...current, fontFamily: event.target.value, fontUrl: "" }))
                        }
                        maxLength={120}
                        disabled={Boolean(settings.fontUrl)}
                      />
                    </label>
                    <label className="focus-ring flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-dashed border-[var(--codex-rule)] px-4 text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-secondary)] hover:border-[var(--codex-mint)] hover:text-[var(--codex-mint)]">
                      <Type className="h-4 w-4" />
                      {uploadingFont
                        ? "Uploading font..."
                        : settings.fontUrl
                          ? "Replace custom font"
                          : "Upload custom font"}
                      <input
                        ref={fontInputRef}
                        type="file"
                        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                        className="sr-only"
                        disabled={uploadingFont}
                        onChange={(event) => void onFontFile(event)}
                      />
                    </label>
                    <label className={fieldLabelClass}>
                      Font scale · {(settings.fontScale ?? 1).toFixed(2)}
                      <input
                        type="range"
                        min="0.85"
                        max="1.3"
                        step="0.05"
                        value={settings.fontScale ?? 1}
                        onChange={(event) =>
                          setSettings((current) => ({ ...current, fontScale: Number(event.target.value) }))
                        }
                        className="w-full accent-[var(--codex-mint)]"
                      />
                    </label>
                  </EditorSection>

                  <EditorSection
                    title="Soundtrack"
                    description="Use a public link from YouTube Music, Spotify, SoundCloud, or Apple Music. Visitors choose when playback starts."
                  >
                    <label className="flex items-center justify-between border border-[var(--codex-rule)] px-3 py-3 text-sm text-[var(--text-secondary)]">
                      Enable on public profile
                      <input
                        type="checkbox"
                        checked={settings.music?.enabled ?? false}
                        onChange={(event) => updateMusic({ enabled: event.target.checked })}
                        className="h-4 w-4 accent-[var(--codex-mint)]"
                      />
                    </label>
                    <label className={fieldLabelClass}>
                      Track or playlist URL
                      <Input
                        type="url"
                        inputMode="url"
                        value={settings.music?.url ?? ""}
                        onChange={(event) => updateMusic({ url: event.target.value })}
                        placeholder="https://music.youtube.com/watch?v=..."
                      />
                    </label>
                    <label className={fieldLabelClass}>
                      Display title
                      <Input
                        value={settings.music?.title ?? ""}
                        onChange={(event) => updateMusic({ title: event.target.value })}
                        placeholder="My profile soundtrack"
                        maxLength={100}
                      />
                    </label>
                    {settings.music?.url ? (
                      <p
                        className={cn(
                          "text-xs",
                          resolveMusicEmbed(settings.music.url) ? "text-emerald-300" : "text-amber-300"
                        )}
                      >
                        {resolveMusicEmbed(settings.music.url)?.providerLabel ?? "This link is not supported."}
                      </p>
                    ) : null}
                    <MusicEmbedPlayer music={settings.music} />
                  </EditorSection>

                  <EditorSection
                    title="Links & access"
                    description="Connect the places where your audience can find you."
                  >
                    {SOCIAL_LINKS.map((key) => (
                      <label key={key} className={fieldLabelClass}>
                        {key}
                        <Input
                          type="url"
                          inputMode="url"
                          value={settings.socialLinks?.[key] ?? ""}
                          onChange={(event) =>
                            setSettings((current) => ({
                              ...current,
                              socialLinks: { ...current.socialLinks, [key]: event.target.value }
                            }))
                          }
                          placeholder={`${key[0].toUpperCase()}${key.slice(1)} URL`}
                        />
                      </label>
                    ))}
                    <label className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                      <input
                        name="ageVerified"
                        type="checkbox"
                        checked={ageVerified}
                        onChange={(event) => setAgeVerified(event.target.checked)}
                        className="mt-1 accent-[var(--codex-mint)]"
                      />
                      I confirm I can access age-gated content settings.
                    </label>
                  </EditorSection>
                </fieldset>
                <div className="account-savebar">
                  <p role="status">
                    {status || (hasProfileChanges ? "Unsaved changes" : "Your profile is up to date")}
                  </p>
                  <div>
                    <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                    <Button type="submit" disabled={saving || uploadingFont || !hasProfileChanges}>
                      {saving ? "Saving…" : uploadingFont ? "Uploading font…" : "Save profile"}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="account-overview">
              <section aria-labelledby="account-characters-title">
                <div className="account-section-title">
                  <div>
                    <p className="codex-kicker">Made by you</p>
                    <h2 id="account-characters-title">Your characters</h2>
                  </div>
                  {characters.length > 0 ? (
                    <button className="account-text-action focus-ring" onClick={() => selectTab("studio")}>
                      View all <ArrowUpRight size={16} />
                    </button>
                  ) : null}
                </div>
                {characters.length ? (
                  <div className="account-recent-characters">
                    {characters.slice(0, 3).map((character) => (
                      <Link
                        key={character.id}
                        href={`/character/${character.id}/edit`}
                        className="account-character-row focus-ring"
                      >
                        <Avatar name={character.name} src={character.avatarUrl} size="lg" />
                        <span>
                          <strong>{character.name}</strong>
                          <small>
                            {character.visibility?.toLowerCase() || "draft"} · {character._count?.chats ?? 0}{" "}
                            {character._count?.chats === 1 ? "chat" : "chats"}
                          </small>
                        </span>
                        <ArrowUpRight size={18} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="account-empty">
                    <Wand2 size={28} />
                    <h3>Your first character starts here.</h3>
                    <p>Give them a name, a voice and a world to belong to.</p>
                  </div>
                )}
                <Link href="/create-character" className="account-create-row focus-ring">
                  <Plus size={20} />
                  <span>
                    Create a character<small>A new voice for your next story</small>
                  </span>
                  <ArrowUpRight size={18} />
                </Link>
                <Link href="/studio" className="account-text-action account-studio-link focus-ring">
                  Creator Studio <ArrowUpRight size={16} />
                </Link>
              </section>
              <aside className="account-public-summary" aria-labelledby="account-public-title">
                <div className="account-section-title">
                  <div>
                    <p className="codex-kicker">Visible to visitors</p>
                    <h2 id="account-public-title">Your public page</h2>
                  </div>
                </div>
                <p className="account-bio">
                  {profile?.bio ||
                    "A few words about you can turn a visitor into a reader. Add a bio when you edit your profile."}
                </p>
                <dl className="account-profile-details">
                  <div>
                    <dt>Appearance</dt>
                    <dd>{PROFILE_THEME_PRESETS[settings.themePreset ?? "midnight"].label}</dd>
                  </div>
                  <div>
                    <dt>Soundtrack</dt>
                    <dd>
                      {settings.music?.enabled && settings.music.url
                        ? settings.music.title || "Connected"
                        : "Not added"}
                    </dd>
                  </div>
                  <div>
                    <dt>Social links</dt>
                    <dd>{Object.values(settings.socialLinks || {}).filter(Boolean).length || "Not added"}</dd>
                  </div>
                </dl>
                <div className="account-public-actions">
                  <button className="account-text-action focus-ring" onClick={() => setPreviewOpen(true)}>
                    <Eye size={16} />
                    Preview page
                  </button>
                  <button
                    className="account-text-action focus-ring"
                    onClick={() => void shareProfile()}
                    disabled={!profile?.username}
                  >
                    {copied ? <Check size={16} /> : <Share2 size={16} />}
                    {copied ? "Copied" : "Share"}
                  </button>
                </div>
              </aside>
            </div>
          )
        ) : tab === "studio" ? (
          <div className="account-characters">
            <CharacterStudio characters={characters} />
          </div>
        ) : (
          <AccountPreferences />
        )}
      </div>
      <Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="account-preview-overlay" />
          <Dialog.Content className="account-preview-dialog">
            <header>
              <div>
                <Dialog.Title>Public page preview</Dialog.Title>
                <Dialog.Description>
                  {profileEditing
                    ? "Unsaved changes are visible only to you."
                    : "See how your profile looks to visitors."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close profile preview">
                  <X size={20} />
                </Button>
              </Dialog.Close>
            </header>
            <div className="account-preview-mode">
              <Choice active={previewMode === "owner"} onClick={() => setPreviewMode("owner")}>
                Owner
              </Choice>
              <Choice active={previewMode === "visitor"} onClick={() => setPreviewMode("visitor")}>
                Visitor
              </Choice>
            </div>
            <PublicProfileView
              username={username || "username"}
              bio={bio}
              avatarUrl={avatarValue}
              accentColor={accentColor}
              settings={settings}
              characters={publicCharacters}
              isOwner
              previewMode={previewMode}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!profileEditing && status ? (
        <p role="status" className="mt-4 rounded-xl border border-[var(--codex-rule)] p-4 text-sm">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function parseAccountTab(value: string | null): AccountTabId {
  return value === "studio" || value === "settings" ? value : "profile";
}

function AccountTab({
  id,
  active,
  onClick,
  children
}: {
  id: AccountTabId;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`account-tab-${id}`}
      aria-controls={`account-panel-${id}`}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const tabs = Array.from(
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []
        );
        const index = tabs.indexOf(event.currentTarget);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next]?.focus();
        tabs[next]?.click();
      }}
      onClick={onClick}
      className="account-tab focus-ring"
    >
      {children}
    </button>
  );
}

function AccountStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EditorSection({
  title,
  description,
  children,
  initiallyOpen = false
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  initiallyOpen?: boolean;
}) {
  return (
    <details className="account-editor-section" open={initiallyOpen || undefined}>
      <summary className="focus-ring">
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <ChevronDown size={18} />
      </summary>
      <div className="account-editor-fields">{children}</div>
    </details>
  );
}

function UploadControl({
  label,
  icon: Icon,
  onChange
}: {
  label: string;
  icon: typeof Camera;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className="focus-ring grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[var(--codex-rule)] bg-[var(--codex-paper)] text-[var(--text-secondary)] hover:text-[var(--codex-mint)]"
      title={label}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onChange} />
    </label>
  );
}

function Choice({
  active = false,
  onClick,
  children
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs capitalize",
        active
          ? "border-[var(--codex-mint)] text-[var(--codex-mint)]"
          : "border-[var(--codex-rule)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
      )}
    >
      {children}
    </button>
  );
}

function CharacterStudio({ characters }: { characters: StudioCharacter[] }) {
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [sort, setSort] = useState("library");
  const matchingCharacters = characters.filter(
    (character) =>
      (visibility === "all" || character.visibility === visibility) &&
      `${character.name} ${character.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  if (sort === "name") matchingCharacters.sort((left, right) => left.name.localeCompare(right.name));
  if (sort === "chats")
    matchingCharacters.sort((left, right) => (right._count?.chats ?? 0) - (left._count?.chats ?? 0));
  return (
    <section className="min-w-0 space-y-5" aria-labelledby="character-studio-title">
      <div className="account-section-title">
        <div className="min-w-0">
          <p className="codex-kicker">Your collection</p>
          <h2 id="character-studio-title" className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
            My characters
          </h2>
        </div>
        <Button asChild size="lg" className="w-full xs:w-auto">
          <Link href="/create-character">
            <Sparkles className="h-4 w-4" />
            Create character
          </Link>
        </Button>
      </div>

      {characters.length ? (
        <div className="account-character-filters">
          <SearchBar value={query} onChange={setQuery} placeholder="Search your characters…" />
          <select
            aria-label="Character visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
            className="focus-ring min-h-12 rounded-xl border border-[var(--codex-rule)] bg-[var(--bg-input)] px-3 text-sm"
          >
            <option value="all">All visibility</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
            <option value="UNLISTED">Unlisted</option>
          </select>
          <select
            aria-label="Sort characters"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="focus-ring"
          >
            <option value="library">Library order</option>
            <option value="name">Name A–Z</option>
            <option value="chats">Most chats</option>
          </select>
        </div>
      ) : null}
      {characters.length > 0 ? (
        <p className="account-result-count" role="status">
          {matchingCharacters.length} of {characters.length} characters
        </p>
      ) : null}
      {characters.length && !matchingCharacters.length ? (
        <div className="space-y-3 py-5 text-sm">
          <p>No characters match these filters.</p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setVisibility("all");
            }}
          >
            Reset filters
          </Button>
        </div>
      ) : null}
      {characters.length ? (
        <div className="account-character-list">
          {matchingCharacters.map((character) => (
            <article key={character.id} className="account-character-entry min-w-0 max-w-full">
              <div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-4">
                <Avatar
                  name={character.name}
                  src={character.avatarUrl}
                  size="lg"
                  className="h-16 w-16 sm:h-20 sm:w-20"
                />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                    {character.name}
                  </h3>
                  <span className="mt-2 inline-flex rounded-full border border-[var(--codex-rule)] px-2.5 py-1 text-[10px] uppercase tracking-[.12em] text-[var(--text-muted)]">
                    {character.visibility?.toLowerCase() ?? "draft"}
                  </span>
                </div>
              </div>
              <p className="account-character-description line-clamp-2 [overflow-wrap:anywhere]">
                {character.description || "A new character waiting for their story."}
              </p>
              <div className="account-character-actions grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  {character._count?.chats ?? 0}
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/character/${character.id}`} aria-label={`View ${character.name}`}>
                    View
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/character/${character.id}/edit`} aria-label={`Edit ${character.name}`}>
                    Edit
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center border border-dashed border-[var(--codex-rule)] px-6 py-16 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--codex-mint)]">
            <Wand2 className="h-8 w-8" />
          </div>
          <h3 className="mt-6 text-xl font-semibold text-[var(--text-primary)]">No characters yet</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
            Create your first character and shape their personality, voice, and world.
          </p>
          <Button asChild className="mt-6">
            <Link href="/create-character">
              <Plus className="h-4 w-4" />
              Create character
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function AccountPreferences() {
  return (
    <section className="account-access" aria-labelledby="mobile-settings-title">
      <div className="account-section-title">
        <div>
          <h2 id="mobile-settings-title">Account & access</h2>
          <p>Sign-in details and preferences, all in one place.</p>
        </div>
      </div>
      <div className="account-settings-groups">
        {["Your identity", "Conversations", "Help"].map((group) => (
          <section key={group}>
            <h3 className="codex-kicker">{group}</h3>
            {SETTINGS_SECTIONS.map((section) => {
              if (section.group !== group || section.href === "/account") return null;
              const Icon = section.icon;
              return (
                <Link key={section.href} href={section.href} className="account-settings-row focus-ring">
                  <Icon size={19} />
                  <span>
                    <strong>{section.label}</strong>
                    <small>{section.description}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              );
            })}
          </section>
        ))}
      </div>
      <details className="account-editor-section account-password-section">
        <summary className="focus-ring">
          <span>
            <strong>Password & sign-in</strong>
            <small>Manage your email-and-password access.</small>
          </span>
          <ChevronDown size={18} />
        </summary>
        <div className="account-editor-fields">
          <AccountPasswordClient callbackUrl="/account?tab=settings" />
        </div>
      </details>
    </section>
  );
}

async function optimizeImage(file: File, maxWidth: number, maxHeight: number) {
  if (!file.type.startsWith("image/") || file.size > MAX_UPLOAD_BYTES)
    throw new Error("Choose a PNG, JPG, or WebP image smaller than 4MB.");
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
