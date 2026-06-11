"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, Eye, Globe, Link2, Lock, Save, SlidersHorizontal, Tags, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Draft = {
  name: string;
  avatarUrl: string;
  description: string;
  personality: string;
  scenario: string;
  greeting: string;
  tags: string;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  isNSFW: boolean;
  tone: string;
  humor: number;
  romanceLevel: number;
  seriousness: number;
  initiative: number;
  messageLength: "short" | "medium" | "long";
  roleplayIntensity: number;
};

const initialDraft: Draft = {
  name: "New character",
  avatarUrl: "",
  description: "Describe who they are, what they want, and what kind of conversations they should create.",
  personality: "Warm, curious, consistent, and attentive to memory.",
  scenario: "A flexible starting scene for the first conversation.",
  greeting: "Hey, I am ready. What should we start with?",
  tags: "roleplay, friend",
  visibility: "PRIVATE",
  isNSFW: false,
  tone: "soft, cinematic",
  humor: 4,
  romanceLevel: 0,
  seriousness: 5,
  initiative: 5,
  messageLength: "medium",
  roleplayIntensity: 5
};

const steps = ["Basics", "Personality", "Settings"] as const;

export default function CreateCharacterPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tagList = useMemo(
    () =>
      draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6),
    [draft.tags]
  );

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: draft.name,
      avatarUrl: draft.avatarUrl,
      description: draft.description,
      personality: draft.personality,
      scenario: draft.scenario,
      greeting: draft.greeting,
      visibility: draft.visibility,
      isNSFW: draft.isNSFW,
      tags: tagList,
      communicationStyle: {
        tone: draft.tone,
        humor: draft.humor,
        romanceLevel: draft.romanceLevel,
        seriousness: draft.seriousness,
        initiative: draft.initiative,
        messageLength: draft.messageLength,
        roleplayIntensity: draft.roleplayIntensity
      }
    };

    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    setSaving(false);
    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not create character.");
      return;
    }

    const body = await response.json();
    router.push(`/character/${body.character.id}`);
  }

  return (
    <div className="container py-6">
      <div className="grid min-h-[calc(100vh-6rem)] gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <form onSubmit={onSubmit} className="app-panel overflow-hidden">
          <div className="flex flex-col justify-between gap-4 border-b border-border p-5 md:flex-row md:items-center">
            <div>
              <h1 className="text-[32px] font-bold leading-10 tracking-tight">Create Character</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Build a persona, tune the voice, and publish it privately or publicly.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {steps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    step === index ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                  )}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {step === 0 ? <BasicsStep draft={draft} update={update} /> : null}
            {step === 1 ? <PersonalityStep draft={draft} update={update} /> : null}
            {step === 2 ? <SettingsStep draft={draft} update={update} /> : null}

            {error ? <p className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

            <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
              <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
                Back
              </Button>
              {step < steps.length - 1 ? (
                <Button type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save character"}
                </Button>
              )}
            </div>
          </div>
        </form>

        <aside className="app-panel h-fit p-5 xl:sticky xl:top-24">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Live preview</h2>
          </div>
          <div className="mt-5 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start gap-4">
              <div className="grid h-[120px] w-[120px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary bg-primary/10 text-primary shadow-card-glow">
                {draft.avatarUrl ? <img src={draft.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Bot className="h-10 w-10" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-character truncate text-2xl font-bold">{draft.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{draft.tone}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tagList.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <PreviewSection title="Description">{draft.description}</PreviewSection>
            <PreviewSection title="Personality">{draft.personality}</PreviewSection>
            <PreviewSection title="Scenario">{draft.scenario}</PreviewSection>
            <div className="mt-4 rounded-2xl border-l-[3px] border-primary bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">
              {draft.greeting}
            </div>
            <Button type="button" variant="secondary" className="mt-4 w-full">
              Test Chat
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function BasicsStep({ draft, update }: { draft: Draft; update: <K extends keyof Draft>(field: K, value: Draft[K]) => void }) {
  return (
    <section>
      <h2 className="text-2xl font-bold leading-8">Basics</h2>
      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-dashed border-border bg-background/55 p-5 text-center transition hover:border-primary hover:bg-primary/5">
          <div className="mx-auto grid h-[120px] w-[120px] place-items-center overflow-hidden rounded-full border-2 border-primary bg-primary/10 text-primary">
            {draft.avatarUrl ? <img src={draft.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Upload className="h-8 w-8" />}
          </div>
          <p className="mt-4 text-sm font-medium">Avatar Upload</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Paste an image URL for now. S3/R2 upload can attach here later.</p>
          <Input className="mt-4" value={draft.avatarUrl} onChange={(event) => update("avatarUrl", event.target.value)} placeholder="Optional image URL" />
        </div>

        <div className="grid gap-4">
          <Field label="Name">
            <Input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Mira of the Ash Library" required />
          </Field>
          <Field label="First greeting">
            <Textarea value={draft.greeting} onChange={(event) => update("greeting", event.target.value)} placeholder="First message" required />
          </Field>
          <Field label="Description">
            <Textarea value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Who is this character?" required />
          </Field>
        </div>
      </div>
    </section>
  );
}

function PersonalityStep({ draft, update }: { draft: Draft; update: <K extends keyof Draft>(field: K, value: Draft[K]) => void }) {
  return (
    <section>
      <h2 className="text-2xl font-bold leading-8">Personality</h2>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Personality">
            <Textarea value={draft.personality} onChange={(event) => update("personality", event.target.value)} placeholder="Traits, boundaries, habits, emotional style" required />
          </Field>
          <Field label="Scenario / world context">
            <Textarea value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} placeholder="World, scene, current situation" />
          </Field>
          <Field label="Tone">
            <Input value={draft.tone} onChange={(event) => update("tone", event.target.value)} placeholder="soft, cinematic" />
          </Field>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-background/55 p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Personality sliders</h3>
          </div>
          <Slider label="Humor" value={draft.humor} onChange={(value) => update("humor", value)} />
          <Slider label="Romance" value={draft.romanceLevel} onChange={(value) => update("romanceLevel", value)} />
          <Slider label="Seriousness" value={draft.seriousness} onChange={(value) => update("seriousness", value)} />
          <Slider label="Initiative" value={draft.initiative} onChange={(value) => update("initiative", value)} />
          <Slider label="Roleplay intensity" value={draft.roleplayIntensity} onChange={(value) => update("roleplayIntensity", value)} />
          <Field label="Message length">
            <select
              value={draft.messageLength}
              onChange={(event) => update("messageLength", event.target.value as Draft["messageLength"])}
              className="focus-ring h-11 w-full rounded-2xl border border-border bg-[hsl(var(--input))] px-4 text-sm"
            >
              <option value="short">Short replies</option>
              <option value="medium">Medium replies</option>
              <option value="long">Long replies</option>
            </select>
          </Field>
        </div>
      </div>
    </section>
  );
}

function SettingsStep({ draft, update }: { draft: Draft; update: <K extends keyof Draft>(field: K, value: Draft[K]) => void }) {
  return (
    <section>
      <h2 className="text-2xl font-bold leading-8">Settings</h2>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Field label="Tags">
          <Input value={draft.tags} onChange={(event) => update("tags", event.target.value)} placeholder="fantasy, friend" />
        </Field>

        <div className="rounded-2xl border border-border bg-background/55 p-5">
          <h3 className="font-semibold">Visibility</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <VisibilityCard icon={Lock} label="Private" selected={draft.visibility === "PRIVATE"} onClick={() => update("visibility", "PRIVATE")} />
            <VisibilityCard icon={Globe} label="Public" selected={draft.visibility === "PUBLIC"} onClick={() => update("visibility", "PUBLIC")} />
            <VisibilityCard icon={Link2} label="Unlisted" selected={draft.visibility === "UNLISTED"} onClick={() => update("visibility", "UNLISTED")} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/55 p-5 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h3 className="font-semibold">Mature Content</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Use the warning state for age-gated or sensitive characters.</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.isNSFW}
              onClick={() => update("isNSFW", !draft.isNSFW)}
              className={cn(
                "relative h-8 w-14 rounded-full transition",
                draft.isNSFW ? "bg-destructive" : "bg-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-6 w-6 rounded-full bg-white transition",
                  draft.isNSFW ? "left-7" : "left-1"
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{value <= 3 ? "Low" : value >= 7 ? "High" : "Medium"}</span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[hsl(var(--primary))]"
      />
    </label>
  );
}

function VisibilityCard({ icon: Icon, label, selected, onClick }: { icon: typeof Lock; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/45"
      )}
    >
      <Icon className="h-5 w-5" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
    </button>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h4 className="text-character text-xs font-semibold uppercase text-muted-foreground">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
