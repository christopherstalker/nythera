"use client";

import { useId, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImageIcon, RotateCcw, Save, Type, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHAT_FONT_PRESETS,
  DEFAULT_CHAT_APPEARANCE,
  normalizeChatAppearance,
  type ChatAppearance
} from "@/lib/chat-appearance";
import { resolveMusicEmbed } from "@/lib/music-embed";
import { CHAT_CUSTOM_FONT_FAMILY } from "@/hooks/use-custom-font";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/use-ui-store";

const MAX_BACKGROUND_BYTES = 100 * 1024 * 1024;
const MAX_FONT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FONT_EXTENSIONS = /\.(?:woff2?|ttf|otf)$/i;
const ACCEPTED_BACKGROUND_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime"
]);

const fieldClass = "focus-ring h-11 w-full rounded-sm border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)]";

export function ChatAppearancePanel() {
  const fileInputId = useId();
  const fontInputId = useId();
  const fontInputRef = useRef<HTMLInputElement>(null);
  const activeChatId = useUiStore((state) => state.activeChatId);
  const draft = useUiStore((state) => state.activeChatAppearance);
  const setStoredAppearance = useUiStore((state) => state.setActiveChatAppearance);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFont, setUploadingFont] = useState(false);

  function update<K extends keyof ChatAppearance>(key: K, value: ChatAppearance[K]) {
    const next = normalizeChatAppearance({ ...draft, [key]: value });
    setStoredAppearance(next);
    setStatus("Previewing unsaved changes.");
  }

  async function persist(next: ChatAppearance, message = "Appearance saved for this chat.") {
    if (!activeChatId) {
      return;
    }

    setSaving(true);
    setStatus("Saving appearance...");
    try {
      const response = await fetch(`/api/chats/${activeChatId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appearance: next })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Could not save appearance.");
      }
      setStoredAppearance(next);
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save appearance.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadBackground(file: File) {
    if (!activeChatId) {
      return;
    }
    if (!ACCEPTED_BACKGROUND_TYPES.has(file.type)) {
      setStatus("Use JPG, PNG, WEBP, GIF, AVIF, MP4, WEBM, or MOV.");
      return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
      setStatus("Background files must be 100 MB or smaller.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setStatus("Uploading background...");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "background";
      const blob = await upload(`chat-backgrounds/${activeChatId}/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/chat-backgrounds/upload",
        clientPayload: JSON.stringify({ chatId: activeChatId }),
        contentType: file.type,
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(percentage))
      });
      const next = normalizeChatAppearance({
        ...draft,
        backgroundMode: "custom",
        backgroundUrl: blob.url,
        backgroundType: file.type.startsWith("video/") ? "video" : "image"
      });
      await persist(next, "Background uploaded and saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not upload background.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function uploadFont(file: File) {
    if (!activeChatId) return;
    if (!ACCEPTED_FONT_EXTENSIONS.test(file.name) || file.size > MAX_FONT_BYTES) {
      setStatus("Use a WOFF2, WOFF, TTF, or OTF font up to 10 MB.");
      return;
    }

    setUploadingFont(true);
    setStatus("Uploading custom font...");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "custom-font.woff2";
      const blob = await upload(`chat-fonts/${activeChatId}/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/fonts/upload",
        clientPayload: JSON.stringify({ scope: "chat", chatId: activeChatId }),
        contentType: file.type || "application/octet-stream"
      });
      const next = normalizeChatAppearance({ ...draft, fontFamily: CHAT_CUSTOM_FONT_FAMILY, fontUrl: blob.url });
      await persist(next, "Custom font uploaded and saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not upload the font.");
    } finally {
      setUploadingFont(false);
    }
  }

  function resetAppearance() {
    const next = { ...DEFAULT_CHAT_APPEARANCE };
    setStoredAppearance(next);
    void persist(next, "Default portrait and typography restored.");
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <div>
          <p className="codex-kicker">Chat background</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">The character portrait is used by default. Upload an image, GIF, MP4, WEBM, or MOV for this conversation.</p>
        </div>

        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Background source">
          {([
            ["default", "Portrait", ImageIcon],
            ["custom", "Custom", Video],
            ["none", "None", RotateCcw]
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={draft.backgroundMode === value}
              onClick={() => update("backgroundMode", value)}
              className={cn(
                "focus-ring flex h-11 items-center justify-center gap-1.5 rounded-sm border text-xs",
                draft.backgroundMode === value
                  ? "border-[var(--codex-mint)] text-[var(--codex-mint)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <label htmlFor={fileInputId} className="focus-ring flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-[var(--border-strong)] px-4 text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-secondary)] hover:border-[var(--codex-mint)] hover:text-[var(--codex-mint)]">
          <Upload className="h-4 w-4" />
          {uploading ? `Uploading ${uploadProgress}%` : "Upload media"}
        </label>
        <input
          id={fileInputId}
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadBackground(file);
            event.currentTarget.value = "";
          }}
        />

        <label className="grid gap-1.5 text-xs text-[var(--text-secondary)]">
          Media URL
          <input
            className={fieldClass}
            value={draft.backgroundUrl}
            onChange={(event) => update("backgroundUrl", event.target.value)}
            onBlur={() => draft.backgroundUrl && update("backgroundMode", "custom")}
            placeholder="https://.../background.mp4"
            inputMode="url"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <SelectField label="Fit" value={draft.backgroundFit} onChange={(value) => update("backgroundFit", value as ChatAppearance["backgroundFit"])} options={["cover", "contain"]} />
          <SelectField label="Position" value={draft.backgroundPosition} onChange={(value) => update("backgroundPosition", value as ChatAppearance["backgroundPosition"])} options={["center", "top", "bottom"]} />
        </div>
        <RangeField label="Dark overlay" value={draft.backgroundDim} min={0} max={0.92} step={0.01} display={`${Math.round(draft.backgroundDim * 100)}%`} onChange={(value) => update("backgroundDim", value)} />
        <RangeField label="Background blur" value={draft.backgroundBlur} min={0} max={24} display={`${draft.backgroundBlur}px`} onChange={(value) => update("backgroundBlur", value)} />
      </section>

      <section className="grid gap-3 border-t border-[var(--border-default)] pt-5">
        <div>
          <p className="codex-kicker">Typography</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Changes appear in the conversation immediately. Any installed font family can be entered manually.</p>
        </div>
        <label className="grid gap-1.5 text-xs text-[var(--text-secondary)]">
          Font preset
          <select
            className={fieldClass}
            value={draft.fontUrl || draft.fontFamily === CHAT_CUSTOM_FONT_FAMILY ? "custom" : CHAT_FONT_PRESETS.some((font) => font.value === draft.fontFamily) ? draft.fontFamily : "manual"}
            onChange={(event) => {
              if (event.target.value === "custom") {
                update("fontFamily", CHAT_CUSTOM_FONT_FAMILY);
                fontInputRef.current?.click();
              }
              else if (event.target.value !== "manual") {
                setStoredAppearance(normalizeChatAppearance({ ...draft, fontFamily: event.target.value, fontUrl: "" }));
                setStatus("Previewing unsaved changes.");
              }
            }}
          >
            {CHAT_FONT_PRESETS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
            <option value="custom">Custom uploaded font</option>
            <option value="manual">Installed font name</option>
          </select>
        </label>
        <label htmlFor={fontInputId} className="focus-ring flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-[var(--border-strong)] px-4 text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-secondary)] hover:border-[var(--codex-mint)] hover:text-[var(--codex-mint)]">
          <Type className="h-4 w-4" />
          {uploadingFont ? "Uploading font..." : draft.fontUrl ? "Replace custom font" : "Upload custom font"}
        </label>
        <input
          id={fontInputId}
          ref={fontInputRef}
          type="file"
          className="sr-only"
          accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
          disabled={uploadingFont}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFont(file);
            event.currentTarget.value = "";
          }}
        />
        <label className="grid gap-1.5 text-xs text-[var(--text-secondary)]">
          Installed font family name
          <input className={fieldClass} value={draft.fontUrl ? "" : draft.fontFamily} onChange={(event) => setStoredAppearance(normalizeChatAppearance({ ...draft, fontFamily: event.target.value, fontUrl: "" }))} placeholder="Font family name" disabled={Boolean(draft.fontUrl)} />
        </label>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <RangeField label="Font size" value={draft.fontSize} min={14} max={38} display={`${draft.fontSize}px`} onChange={(value) => update("fontSize", value)} />
          <label className="grid gap-1.5 text-xs text-[var(--text-secondary)]">Text color<input type="color" className="h-11 w-full cursor-pointer rounded-sm border border-[var(--border-default)] bg-[var(--bg-input)] p-1" value={draft.textColor} onChange={(event) => update("textColor", event.target.value)} /></label>
        </div>
        <RangeField label="Weight" value={draft.fontWeight} min={300} max={800} step={100} display={String(draft.fontWeight)} onChange={(value) => update("fontWeight", value)} />
        <RangeField label="Line height" value={draft.lineHeight} min={1.15} max={2.2} step={0.05} display={draft.lineHeight.toFixed(2)} onChange={(value) => update("lineHeight", value)} />
        <RangeField label="Text width" value={draft.contentWidth} min={560} max={1200} step={20} display={`${draft.contentWidth}px`} onChange={(value) => update("contentWidth", value)} />
      </section>

      <section className="grid gap-3 border-t border-[var(--border-default)] pt-5">
        <div>
          <p className="codex-kicker">Soundtrack</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Attach a YouTube Music, Spotify, SoundCloud, or Apple Music link. Playback starts only after the listener taps play.</p>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-sm border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)]">
          Enable for this chat
          <input
            type="checkbox"
            checked={draft.music.enabled}
            onChange={(event) => update("music", { ...draft.music, enabled: event.target.checked })}
            className="h-4 w-4 accent-[var(--codex-mint)]"
          />
        </label>
        <label className="grid gap-1.5 text-xs text-[var(--text-secondary)]">
          Track or playlist URL
          <input
            className={fieldClass}
            value={draft.music.url}
            onChange={(event) => update("music", { ...draft.music, url: event.target.value })}
            placeholder="https://open.spotify.com/track/..."
            inputMode="url"
          />
        </label>
        <label className="grid gap-1.5 text-xs text-[var(--text-secondary)]">
          Display title
          <input
            className={fieldClass}
            value={draft.music.title}
            onChange={(event) => update("music", { ...draft.music, title: event.target.value })}
            placeholder="Character soundtrack"
            maxLength={100}
          />
        </label>
        {draft.music.url ? (
          <p className={cn("text-xs", resolveMusicEmbed(draft.music.url) ? "text-emerald-300" : "text-amber-300")}>
            {resolveMusicEmbed(draft.music.url)?.providerLabel ?? "This link is not supported."}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-default)] pt-5">
        <Button type="button" variant="outline" onClick={resetAppearance} disabled={saving || uploading || uploadingFont}><RotateCcw className="h-4 w-4" />Reset</Button>
        <Button type="button" onClick={() => void persist(draft)} disabled={!activeChatId || saving || uploading || uploadingFont}><Save className="h-4 w-4" />{saving ? "Saving" : "Save"}</Button>
      </div>
      {status ? <p role="status" className="border-l-2 border-[var(--codex-mint)] pl-3 text-xs leading-5 text-[var(--text-secondary)]">{status}</p> : null}
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs capitalize text-[var(--text-secondary)]">{label}<select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function RangeField({ label, value, min, max, step = 1, display, onChange }: { label: string; value: number; min: number; max: number; step?: number; display: string; onChange: (value: number) => void }) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-xs text-[var(--text-secondary)]">
      <span>{label}</span><span className="tabular-nums text-[var(--text-primary)]">{display}</span>
      <input className="col-span-2 w-full accent-[var(--codex-mint)]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
