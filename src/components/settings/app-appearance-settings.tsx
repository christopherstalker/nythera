"use client";

import { useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowUp, Check, Download, Palette, RotateCcw, Upload } from "lucide-react";
import { useAppAppearance } from "@/components/providers/app-appearance-provider";
import {
  APP_THEME_PRESETS,
  DEFAULT_APP_APPEARANCE,
  appAppearanceSchema,
  appAppearanceStyle,
  contrastRatio,
  type AppAppearance
} from "@/lib/app-appearance";
import "./app-appearance-settings.css";

const colorFields: Array<{ key: keyof AppAppearance["colors"]; label: string }> = [
  { key: "background", label: "Page background" },
  { key: "surface", label: "Panels & cards" },
  { key: "elevated", label: "Raised surfaces" },
  { key: "text", label: "Main text" },
  { key: "muted", label: "Secondary text" },
  { key: "accent", label: "Primary accent" },
  { key: "secondary", label: "Secondary accent" },
  { key: "border", label: "Borders" }
];

export function AppAppearanceSettings() {
  const preferences = useAppAppearance();
  const [notice, setNotice] = useState("");
  return (
    <div className="theme-studio">
      <header className="theme-heading">
        <div>
          <span className="theme-eyebrow">YOUR SPACE</span>
          <h2>Make Nythera yours.</h2>
          <p>Start with a palette. Make every detail feel like home.</p>
        </div>
        <span className="theme-scope">
          <Palette size={15} aria-hidden />
          Personal to your account
        </span>
      </header>
      {notice ? (
        <p className="studio-notice" role="status">
          {notice}
        </p>
      ) : null}
      {preferences.error ? (
        <div className="studio-notice" role="alert">
          {preferences.error}{" "}
          <button type="button" className="studio-secondary" onClick={preferences.reload}>
            Try again
          </button>
        </div>
      ) : null}
      {!preferences.ready && !preferences.error ? <p role="status">Loading your theme…</p> : null}
      {preferences.ready ? (
        <ThemeEditor
          key={JSON.stringify(preferences.appearance)}
          initial={preferences.appearance}
          save={preferences.save}
          onSaved={setNotice}
        />
      ) : null}
    </div>
  );
}

function ThemeEditor({
  initial,
  save,
  onSaved
}: {
  initial: AppAppearance | null;
  save: (appearance: AppAppearance | null) => Promise<void>;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = useState<AppAppearance>(initial ?? DEFAULT_APP_APPEARANCE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const changed = JSON.stringify(draft) !== JSON.stringify(initial);
  const contrast = Math.min(
    contrastRatio(draft.colors.text, draft.colors.background),
    contrastRatio(draft.colors.text, draft.colors.surface)
  );

  function update<K extends keyof AppAppearance>(key: K, value: AppAppearance[K]) {
    setDraft((previous) => ({ ...previous, [key]: value, preset: "custom" }));
    onSaved("");
    setImportNotice("");
  }

  async function persist(next: AppAppearance | null) {
    setSaving(true);
    setError("");
    try {
      await save(next);
      onSaved(
        next
          ? "Theme saved to your account. It will follow you on your other devices."
          : "Original Nythera appearance restored."
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  }

  function exportTheme() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nythera-${draft.preset}-theme.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importTheme(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      if (file.size > 16 * 1024) throw new Error("Choose a Nythera theme file smaller than 16 KB.");
      const imported = appAppearanceSchema.safeParse(JSON.parse(await file.text()));
      if (!imported.success)
        throw new Error("This file is not a supported Nythera theme. Export a version 1 theme and try again.");
      setDraft(imported.data);
      onSaved("");
      setImportNotice("Theme imported into the preview. Save to apply it.");
    } catch (failure) {
      setError(
        failure instanceof SyntaxError
          ? "This file is not valid JSON."
          : failure instanceof Error
            ? failure.message
            : "Could not import this theme."
      );
    }
  }

  return (
    <>
      <fieldset className="theme-fieldset" disabled={saving}>
        <legend className="sr-only">Personal appearance</legend>
        <div className="theme-section-label">
          <h3>A starting point</h3>
          <span>Deep colors. Quiet details.</span>
        </div>
        <div className="theme-presets" role="group" aria-label="Theme presets">
          {APP_THEME_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className="theme-preset"
              aria-pressed={draft.preset === preset.id}
              onClick={() => {
                setDraft(preset.appearance);
                onSaved("");
                setImportNotice("");
              }}
            >
              <span
                className="theme-preset-art"
                style={
                  {
                    background: preset.appearance.colors.background,
                    "--preset-panel": preset.appearance.colors.surface,
                    "--preset-accent": preset.appearance.colors.accent,
                    "--preset-text": preset.appearance.colors.text
                  } as CSSProperties
                }
              >
                <span className="theme-preset-rail" />
                <span className="theme-preset-lines">
                  <i />
                  <i />
                  <i />
                  <b />
                </span>
                {draft.preset === preset.id ? (
                  <span className="theme-preset-check">
                    <Check size={13} aria-hidden />
                  </span>
                ) : null}
              </span>
              <strong>{preset.name}</strong>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
        <div className="theme-editor-grid">
          <div className="theme-controls">
            <section className="theme-section">
              <div className="theme-section-label">
                <h3>Your palette</h3>
                <span>{draft.preset === "custom" ? "Custom blend" : "Fine-tune any color"}</span>
              </div>
              <div className="theme-colors">
                {colorFields.map(({ key, label }) => (
                  <ColorField
                    key={key}
                    label={label}
                    value={draft.colors[key]}
                    onChange={(color) => update("colors", { ...draft.colors, [key]: color })}
                  />
                ))}
              </div>
              <p className={`theme-contrast ${contrast < 4.5 ? "theme-contrast-low" : ""}`} role="status">
                Text contrast {contrast.toFixed(1)}:1.
                {contrast < 4.5
                  ? " Some text may be hard to read. Try a lighter text color or a darker background."
                  : " Clear against your background and panels."}
              </p>
            </section>
            <section className="theme-section">
              <div className="theme-section-label">
                <h3>Shape & typography</h3>
              </div>
              <div className="theme-selects">
                <label>
                  Interface font
                  <select
                    value={draft.font}
                    onChange={(event) => update("font", event.target.value as AppAppearance["font"])}
                  >
                    <option value="space-grotesk">Nythera · Space Grotesk</option>
                    <option value="system">System sans-serif</option>
                    <option value="serif">Book · Lora</option>
                  </select>
                </label>
                <label>
                  Spacing
                  <select
                    value={draft.density}
                    onChange={(event) => update("density", event.target.value as AppAppearance["density"])}
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </label>
              </div>
              <ThemeRange
                label="Interface text size"
                value={draft.fontSize}
                min={14}
                max={20}
                unit="px"
                onChange={(value) => update("fontSize", value)}
              />
              <ThemeRange
                label="Corner roundness"
                value={draft.roundness}
                min={0}
                max={28}
                unit="px"
                onChange={(value) => update("roundness", value)}
              />
            </section>
            <section className="theme-section">
              <div className="theme-section-label">
                <h3>Surfaces & motion</h3>
              </div>
              <ThemeRange
                label="Panel opacity"
                value={draft.surfaceOpacity}
                min={60}
                max={100}
                unit="%"
                onChange={(value) => update("surfaceOpacity", value)}
              />
              <ThemeRange
                label="Background blur"
                value={draft.blur}
                min={0}
                max={24}
                unit="px"
                onChange={(value) => update("blur", value)}
              />
              <label className="theme-toggle">
                <span>
                  <strong>Reduce motion</strong>
                  <small>Keep transitions and decorative animations still.</small>
                </span>
                <input
                  type="checkbox"
                  checked={draft.reduceMotion}
                  onChange={(event) => update("reduceMotion", event.target.checked)}
                />
              </label>
            </section>
            <div className="theme-portability">
              <button type="button" className="studio-secondary" onClick={exportTheme}>
                <Download size={15} aria-hidden />
                Export theme
              </button>
              <button type="button" className="studio-secondary" onClick={() => uploadRef.current?.click()}>
                <Upload size={15} aria-hidden />
                Import theme
              </button>
              <input
                ref={uploadRef}
                type="file"
                accept=".json,application/json"
                aria-label="Import theme file"
                className="sr-only"
                onChange={importTheme}
              />
            </div>
          </div>
          <aside className="theme-preview-column">
            <div className="theme-section-label">
              <h3>Live preview</h3>
              <span>Only you will see this theme</span>
            </div>
            <ThemePreview appearance={draft} />
            <p className="theme-preview-note">
              Your chat fonts, scene backgrounds and reading width have their own controls.
            </p>
            <div className="theme-related">
              <Link href="/settings/interface">Reading settings ↗</Link>
              <Link href="/settings/atmosphere">Story atmosphere ↗</Link>
            </div>
          </aside>
        </div>
      </fieldset>
      {importNotice ? (
        <p className="studio-notice" role="status">
          {importNotice}
        </p>
      ) : null}
      {error ? (
        <p className="studio-notice" role="alert">
          {error}
        </p>
      ) : null}
      <footer className="theme-save-bar">
        <button
          type="button"
          className="theme-reset"
          disabled={saving || initial === null}
          onClick={() => void persist(null)}
        >
          <RotateCcw size={15} aria-hidden />
          Restore original
        </button>
        <div>
          <button
            type="button"
            className="studio-secondary"
            disabled={saving || !changed}
            onClick={() => {
              setDraft(initial ?? DEFAULT_APP_APPEARANCE);
              setError("");
              setImportNotice("");
            }}
          >
            Discard edits
          </button>
          <button
            type="button"
            className="studio-primary"
            disabled={saving || !changed}
            onClick={() => void persist(draft)}
          >
            {saving ? "Saving…" : "Save appearance"}
          </button>
        </div>
      </footer>
    </>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const [typed, setTyped] = useState(value);
  const [previous, setPrevious] = useState(value);
  if (value !== previous) {
    setPrevious(value);
    setTyped(value);
  }
  const invalid = !/^#[\da-f]{6}$/i.test(typed);
  return (
    <div className="theme-color-field">
      <label>
        <span>{label}</span>
        <span className="theme-color-controls">
          <input
            type="color"
            value={value}
            onChange={(event) => {
              setTyped(event.target.value);
              onChange(event.target.value);
            }}
            aria-label={`Choose ${label.toLowerCase()}`}
          />
          <input
            type="text"
            value={typed}
            maxLength={7}
            aria-label={`${label} hex`}
            aria-invalid={invalid}
            spellCheck={false}
            onBlur={() => {
              if (invalid) setTyped(value);
            }}
            onChange={(event) => {
              setTyped(event.target.value);
              if (/^#[\da-f]{6}$/i.test(event.target.value)) onChange(event.target.value);
            }}
          />
        </span>
      </label>
    </div>
  );
}

function ThemeRange({
  label,
  value,
  min,
  max,
  unit,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="theme-range">
      <span>
        {label}
        <output>
          {value}
          {unit}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        value={value}
        min={min}
        max={max}
        step={1}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ThemePreview({ appearance }: { appearance: AppAppearance }) {
  return (
    <div
      className="personal-theme-preview"
      style={appAppearanceStyle(appearance) as CSSProperties}
      aria-label="Live theme preview"
    >
      <div className="theme-mini-header">
        <span className="theme-mini-logo">N</span>
        <strong>Nythera</strong>
        <span className="theme-mini-account">S</span>
      </div>
      <div className="theme-mini-nav">
        <span>Discover</span>
        <span className="theme-mini-selected">Your stories</span>
        <span>Library</span>
      </div>
      <div className="theme-mini-content">
        <span className="theme-mini-eyebrow">CHAPTER ONE</span>
        <h4>The midnight archive</h4>
        <p className="theme-mini-subtitle">Elena Vale · a story in the making</p>
        <div className="theme-mini-story">
          <div className="theme-mini-speaker">
            <span>E</span>
            <strong>Elena Vale</strong>
          </div>
          <p>
            The last lamp flickered as you stepped inside. Rain traced quiet paths down the windows, turning the city
            into a blur of light.
          </p>
          <p className="theme-mini-dialogue">“You came back.”</p>
          <p>She moved the chair beside her just enough to make room.</p>
        </div>
        <div className="theme-mini-reply">
          <small>YOU</small>
          <p>“Some stories are worth returning to.”</p>
        </div>
        <div className="theme-mini-composer">
          <span>What happens next?</span>
          <span className="theme-mini-send">
            <ArrowUp size={16} aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}
