"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, RotateCcw, X } from "lucide-react";
import { CHAT_FONT_PRESETS, type ChatAppearance } from "@/lib/chat-appearance";
import { SettingsPreferenceToggle } from "@/components/settings/settings-preference-toggle";
import { StoryPreview } from "@/components/settings/story-preview";
import { useStoryAppearance } from "@/components/settings/use-story-appearance";

const presets = [
  { id: "book", title: "Book", copy: "Room to linger", fontFamily: "Lora", fontSize: 22, lineHeight: 1.8 },
  {
    id: "dialogue",
    title: "Dialogue",
    copy: "A quicker rhythm",
    fontFamily: "Space Grotesk",
    fontSize: 18,
    lineHeight: 1.6
  },
  { id: "focus", title: "Focus", copy: "Only the words", fontFamily: "Lora", fontSize: 24, lineHeight: 1.9 }
] as const;
type RecentStory = { id: string; title: string | null; character: { name: string } };

export function StoryAppearanceSettings({ chatId, section }: { chatId?: string; section: "reading" | "atmosphere" }) {
  const preferences = useStoryAppearance(chatId);
  const { draft, update, dirty, saved, story, loading, saving, error, status } = preferences;
  const pathname = usePathname();
  const router = useRouter();
  const [recentStories, setRecentStories] = useState<RecentStory[]>([]);
  const [storiesUnavailable, setStoriesUnavailable] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/chats", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const history = await response.json();
        if (!controller.signal.aborted) setRecentStories(history.chats);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStoriesUnavailable(true);
      });
    return () => controller.abort();
  }, []);

  function selectScope(nextChatId: string) {
    if (saving || (dirty && !window.confirm("Discard your unsaved appearance changes?"))) return;
    router.push(nextChatId ? `${pathname}?${new URLSearchParams({ chatId: nextChatId })}` : pathname);
  }

  const selectedPreset = presets.find(
    (preset) =>
      preset.fontFamily === draft.fontFamily &&
      preset.fontSize === draft.fontSize &&
      preset.lineHeight === draft.lineHeight &&
      !draft.fontUrl &&
      (preset.id !== "focus" || draft.backgroundMode === "none")
  );
  const unavailable = loading || !saved;
  return (
    <div className="studio-appearance">
      <div className="studio-scope-row">
        <div>
          <p className="studio-eyebrow">{section === "reading" ? "01 / Reading" : "02 / Atmosphere"}</p>
          <h2>{section === "reading" ? "Find your reading rhythm." : "Give the scene a feeling."}</h2>
        </div>
        <label className="studio-scope-label">
          Apply changes to
          <select
            aria-label="Apply appearance to"
            value={chatId || ""}
            disabled={saving}
            onChange={(event) => selectScope(event.target.value)}
          >
            <option value="">New chats · your defaults</option>
            {chatId && !recentStories.some((chat) => chat.id === chatId) ? (
              <option value={chatId}>{story?.title || "This conversation"}</option>
            ) : null}
            {recentStories.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.character.name} · {chat.title || "Untitled conversation"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="studio-scope-note">
        {chatId
          ? `Only ${story ? `“${story.title}”` : "this conversation"}. Your defaults stay as they are.`
          : "Your defaults. Existing stories stay as they are."}{" "}
        {storiesUnavailable ? "Open Story Studio from a chat to edit that conversation." : null}
      </p>
      {loading ? (
        <p className="studio-notice" role="status">
          Loading your appearance…
        </p>
      ) : null}
      {!loading && !saved ? (
        <div className="studio-notice" role="alert">
          <p>{error}</p>
          <button className="studio-secondary" onClick={preferences.retry}>
            Try again
          </button>
        </div>
      ) : null}
      <div className="studio-appearance-grid">
        <div className="studio-controls">
          <fieldset disabled={unavailable || saving}>
            <legend className="sr-only">{section === "reading" ? "Reading settings" : "Atmosphere settings"}</legend>
            {section === "reading" ? (
              <>
                <div className="studio-setting">
                  <p className="studio-control-heading">
                    Start with a style <small>Fine-tune below</small>
                  </p>
                  <div className="studio-presets" role="group" aria-label="Reading presets">
                    {presets.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        aria-pressed={selectedPreset?.id === preset.id}
                        onClick={() =>
                          update({
                            fontFamily: preset.fontFamily,
                            fontSize: preset.fontSize,
                            lineHeight: preset.lineHeight,
                            fontUrl: "",
                            backgroundMode: preset.id === "focus" ? "none" : "default"
                          })
                        }
                      >
                        <span className="studio-mini-page" aria-hidden>
                          <i />
                          <i />
                          <i />
                        </span>
                        <strong>{preset.title}</strong>
                        <small>{preset.copy}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <label className="studio-setting">
                  <span className="studio-control-heading">Typeface</span>
                  <select
                    value={draft.fontUrl ? "custom" : draft.fontFamily}
                    onChange={(event) => update({ fontFamily: event.target.value, fontUrl: "" })}
                  >
                    {draft.fontUrl ? <option value="custom">Your custom font</option> : null}
                    {!draft.fontUrl &&
                    !CHAT_FONT_PRESETS.some((font) => font.value === draft.fontFamily) &&
                    draft.fontFamily !== "Space Grotesk" ? (
                      <option value={draft.fontFamily}>{draft.fontFamily}</option>
                    ) : null}
                    {CHAT_FONT_PRESETS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                    <option value="Space Grotesk">Space Grotesk · Modern</option>
                  </select>
                </label>
                <AppearanceRange
                  label="Text size"
                  value={draft.fontSize}
                  min={14}
                  max={38}
                  unit=" px"
                  onChange={(fontSize) => update({ fontSize })}
                />
                <AppearanceRange
                  label="Breathing room"
                  value={draft.lineHeight}
                  min={1.15}
                  max={2.2}
                  step={0.05}
                  onChange={(lineHeight) => update({ lineHeight })}
                />
                <details className="studio-advanced">
                  <summary>More reading options</summary>
                  <AppearanceRange
                    label="Text weight"
                    value={draft.fontWeight}
                    min={300}
                    max={800}
                    step={100}
                    onChange={(fontWeight) => update({ fontWeight })}
                  />
                  <AppearanceRange
                    label="Reading width"
                    value={draft.contentWidth}
                    min={560}
                    max={1200}
                    step={40}
                    unit=" px"
                    onChange={(contentWidth) => update({ contentWidth })}
                  />
                  <label className="studio-setting studio-color">
                    Text color{" "}
                    <input
                      aria-label="Text color"
                      type="color"
                      value={draft.textColor}
                      onChange={(event) => update({ textColor: event.target.value })}
                    />
                  </label>
                  <label className="studio-setting studio-check">
                    <input
                      type="checkbox"
                      checked={draft.backgroundMode === "none"}
                      onChange={(event) => update({ backgroundMode: event.target.checked ? "none" : "default" })}
                    />
                    <span>
                      Quiet page<small>Hide the character background.</small>
                    </span>
                  </label>
                </details>
              </>
            ) : (
              <>
                <div className="studio-setting">
                  <p className="studio-control-heading">Scene palette</p>
                  <div className="studio-palettes" role="group" aria-label="Scene palette">
                    {(
                      [
                        ["character", "Character"],
                        ["moss", "Moss"],
                        ["midnight", "Midnight"],
                        ["ember", "Ember"]
                      ] as const
                    ).map(([scenePalette, label]) => (
                      <button
                        key={scenePalette}
                        type="button"
                        data-palette={scenePalette}
                        aria-pressed={draft.scenePalette === scenePalette}
                        onClick={() =>
                          update({ scenePalette, backgroundMode: scenePalette === "character" ? "default" : "none" })
                        }
                      >
                        <span aria-hidden />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="studio-setting">
                  <span className="studio-control-heading">Background source</span>
                  <select
                    value={draft.backgroundMode}
                    onChange={(event) =>
                      update({ backgroundMode: event.target.value as ChatAppearance["backgroundMode"] })
                    }
                  >
                    <option value="default">Character portrait</option>
                    <option value="none">Palette only</option>
                    {draft.backgroundUrl ? <option value="custom">Your custom background</option> : null}
                  </select>
                </label>
                <AppearanceRange
                  label="Background dimming"
                  disabled={draft.backgroundMode === "none"}
                  value={Math.round(draft.backgroundDim * 100)}
                  min={0}
                  max={92}
                  unit="%"
                  onChange={(value) => update({ backgroundDim: value / 100 })}
                />
                <AppearanceRange
                  label="Background blur"
                  disabled={draft.backgroundMode === "none"}
                  value={draft.backgroundBlur}
                  min={0}
                  max={24}
                  unit=" px"
                  onChange={(backgroundBlur) => update({ backgroundBlur })}
                />
                <p className="studio-notice">
                  {draft.backgroundMode === "none" ? "Choose a background to adjust dimming and blur. " : null}
                  Character portraits vary by story. The preview uses a sample landscape.{" "}
                  {chatId
                    ? "Upload backgrounds, fonts and music from the Appearance panel inside your chat."
                    : "Set custom backgrounds and music inside individual chats."}
                </p>
                {chatId ? (
                  <Link href={`/chat/${encodeURIComponent(chatId)}`} className="studio-back">
                    Return to chat for uploads ↗
                  </Link>
                ) : null}
              </>
            )}
          </fieldset>
          {section === "reading" ? (
            <details className="studio-advanced studio-account-preference">
              <summary>Account-wide chat density</summary>
              <p className="studio-scope-note">Applies to all your chats and saves immediately.</p>
              <SettingsPreferenceToggle preference="compactMode" />
            </details>
          ) : null}
        </div>
        <aside className="studio-desktop-preview">
          <p className="studio-preview-heading">
            <span>● Live preview</span>Sample scene
          </p>
          <StoryPreview appearance={draft} />
          <p className="studio-scope-note">A sample conversation. Your real messages stay private.</p>
        </aside>
      </div>
      <div className="studio-savebar">
        <p role={error && saved ? "alert" : "status"} className={error && saved ? "studio-error" : ""}>
          {error && saved
            ? error
            : status ||
              (dirty
                ? "Unsaved changes · Preview first. Save when it feels right."
                : chatId
                  ? "Appearance for this conversation"
                  : "Your defaults for new chats")}
        </p>
        <div className="studio-save-actions">
          <button
            className="studio-secondary"
            aria-label="Undo unsaved changes"
            disabled={!dirty || saving}
            onClick={preferences.undo}
          >
            <RotateCcw size={16} />
            <span className="studio-undo-label">Undo</span>
          </button>
          <Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
            <Dialog.Trigger asChild>
              <button className="studio-secondary studio-open-preview" disabled={unavailable}>
                Preview <ArrowUpRight size={16} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="studio-dialog-overlay" />
              <Dialog.Content className="studio-preview-dialog">
                <header>
                  <Dialog.Title>Live preview</Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="studio-secondary" aria-label="Close preview">
                      <X size={18} />
                    </button>
                  </Dialog.Close>
                </header>
                <Dialog.Description className="studio-scope-note">
                  A sample scene with your current appearance.
                </Dialog.Description>
                <StoryPreview appearance={draft} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <button
            className="studio-primary"
            disabled={!dirty || saving || unavailable}
            onClick={() => void preferences.save()}
          >
            {saving ? "Saving…" : chatId ? "Save for story" : "Save defaults"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppearanceRange({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled = false,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="studio-setting">
      <span className="studio-control-heading">
        {label}
        <output>
          {Number(value.toFixed(2))}
          {unit}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="studio-range-ends">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </span>
    </label>
  );
}
