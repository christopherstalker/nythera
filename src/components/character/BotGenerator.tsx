"use client";

import { ImagePlus, Sparkles } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { TagChipInput } from "@/components/characters/tag-chip-input";
import { GlassButton } from "@/components/ui/GlassButton";
import { ImageFilePicker } from "@/components/ui/image-file-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GeneratedCharacterConcept } from "@/lib/generation/character-generator-types";

const GENERATION_STEPS = [
  { id: "concept", label: "Analyzing concept...", duration: 2000 },
  { id: "personality", label: "Crafting personality...", duration: 2500 },
  { id: "backstory", label: "Weaving backstory...", duration: 2500 },
  { id: "voice", label: "Defining voice...", duration: 2000 },
  { id: "polish", label: "Polishing character...", duration: 1500 }
] as const;

export function BotGenerator({ onApply }: { onApply: (generated: GeneratedCharacterConcept) => void }) {
  const [concept, setConcept] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [preview, setPreview] = useState<GeneratedCharacterConcept | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = useMemo(() => preview ? requiredFields.every((field) => preview[field].trim().length > 0) && preview.tags.length > 0 : false, [preview]);

  async function generate() {
    if (concept.trim().length < 8) {
      setError("Describe your character in at least 8 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);
    setStepIndex(0);
    let elapsed = 0;
    const timers = GENERATION_STEPS.slice(1).map((step, index) => {
      elapsed += GENERATION_STEPS[index]?.duration ?? 0;
      return window.setTimeout(() => setStepIndex(index + 1), elapsed);
    });

    try {
      const response = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concept: concept.trim() })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.generated) {
        setError(body?.error ?? "Character generation failed.");
        return;
      }
      setPreview(body.generated);
      setStepIndex(GENERATION_STEPS.length - 1);
    } catch {
      setError("Character generation failed. Check your provider settings and try again.");
    } finally {
      timers.forEach(window.clearTimeout);
      setLoading(false);
    }
  }

  function update<K extends keyof GeneratedCharacterConcept>(field: K, value: GeneratedCharacterConcept[K]) {
    setPreview((current) => current ? { ...current, [field]: value } : current);
  }

  return (
    <div className="neo-glass-panel space-y-5 p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Character generator</p>
        <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Turn a premise into a complete character</h3>
      </div>

      <Field label="Character concept">
        <Textarea value={concept} onChange={(event) => setConcept(event.target.value)} placeholder={'Describe your character... e.g. "A mysterious vampire librarian"'} rows={4} maxLength={2000} />
      </Field>
      <GlassButton variant="glass-primary" onClick={() => void generate()} disabled={loading || concept.trim().length < 8}>
        <Sparkles className="h-4 w-4" /> {loading ? "Generating..." : "Generate"}
      </GlassButton>

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2" aria-live="polite">
          {GENERATION_STEPS.map((step, index) => (
              <div key={step.id} className={`neo-glass-card px-3 py-3 text-sm transition ${index <= stepIndex ? "opacity-100" : "opacity-35"}`}>
              <span className={index === stepIndex ? "animate-pulse motion-reduce:animate-none" : ""}>{step.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}

      {preview ? (
        <div className="neo-glass-card space-y-5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <CharacterAvatar name={preview.name} avatarUrl={preview.avatarUrl} size="xl" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">Portrait</p>
              <p className="max-w-lg text-xs leading-5 text-[var(--text-muted)]">Upload a portrait now, or keep the generated avatar prompt for your image workflow.</p>
              <ImageFilePicker onPick={(avatarUrl) => update("avatarUrl", avatarUrl)} onError={setError}>
                <span className="neo-glass-icon-btn inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm text-[var(--text-secondary)]"><ImagePlus className="h-4 w-4" /> Upload avatar</span>
              </ImageFilePicker>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input value={preview.name} onChange={(event) => update("name", event.target.value)} maxLength={80} /></Field>
            <Field label="Description"><Input value={preview.description} onChange={(event) => update("description", event.target.value)} maxLength={240} /></Field>
          </div>
          <Field label="Personality"><Textarea value={preview.personality} onChange={(event) => update("personality", event.target.value)} rows={4} /></Field>
          <Field label="Background"><Textarea value={preview.background} onChange={(event) => update("background", event.target.value)} rows={6} /></Field>
          <Field label="Speech pattern"><Textarea value={preview.speechPattern} onChange={(event) => update("speechPattern", event.target.value)} rows={3} /></Field>
          <Field label="Scenario"><Textarea value={preview.scenario} onChange={(event) => update("scenario", event.target.value)} rows={3} /></Field>
          <Field label="First message"><Textarea value={preview.firstMessage} onChange={(event) => update("firstMessage", event.target.value)} rows={3} /></Field>
          <Field label="Tags"><TagChipInput value={preview.tags} onChange={(tags) => update("tags", tags)} /></Field>
          <Field label="Avatar prompt"><Textarea value={preview.avatarPrompt} onChange={(event) => update("avatarPrompt", event.target.value)} rows={3} /></Field>

          <div className="flex flex-wrap gap-2">
            <GlassButton variant="glass-primary" onClick={() => onApply(preview)} disabled={!ready}>Looks good</GlassButton>
            <GlassButton variant="glass-secondary" onClick={() => void generate()} disabled={loading}>Regenerate</GlassButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const requiredFields: Array<Exclude<keyof GeneratedCharacterConcept, "tags" | "avatarUrl">> = [
  "name",
  "description",
  "personality",
  "background",
  "speechPattern",
  "scenario",
  "firstMessage",
  "avatarPrompt"
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-[var(--text-secondary)]"><span>{label}</span>{children}</label>;
}
