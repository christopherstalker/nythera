"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, Eye, Globe, Link2, Lock, Save, SlidersHorizontal, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { PageHeader, PageShell, SurfaceMuted } from "@/components/ui/page";
import { cn } from "@/lib/utils";

type Draft = {
  name: string;
  avatarUrl: string;
  description: string;
  personality: string;
  scenario: string;
  greeting: string;
  tags: string;
  role: string;
  traits: string;
  speakingStyle: string;
  emotionalTone: string;
  boundaries: string;
  motivation: string;
  behavioralRules: string;
  verbosityLevel: "concise" | "balanced" | "expressive" | "immersive";
  relationshipStyle: "friend" | "romantic" | "mentor" | "rival";
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
  role: "A thoughtful companion who anchors the conversation in a vivid scene.",
  traits: "warm, curious, consistent, emotionally attentive",
  speakingStyle: "Cinematic, natural, and grounded in sensory details.",
  emotionalTone: "soft, inviting, and emotionally present",
  boundaries: "Keep the interaction safe, fictional, respectful, and consensual.",
  motivation: "Help the user feel immersed while preserving continuity and emotional safety.",
  behavioralRules: "Stay in character, remember preferences, avoid generic assistant phrasing, ask scene-forward questions.",
  verbosityLevel: "balanced",
  relationshipStyle: "friend",
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

const steps = [
  {
    label: "Basics",
    hint: "Name the persona and set the first moment."
  },
  {
    label: "Personality",
    hint: "Shape how they speak, react, and remember."
  },
  {
    label: "Settings",
    hint: "Choose discovery, tags, and safety state."
  }
] as const;

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
      persona: {
        name: draft.name,
        role: draft.role,
        personalityTraits: splitList(draft.traits, 16),
        speakingStyle: draft.speakingStyle,
        emotionalTone: draft.emotionalTone,
        boundaries: splitList(draft.boundaries, 12),
        motivation: draft.motivation,
        behavioralRules: splitList(draft.behavioralRules, 12),
        verbosityLevel: draft.verbosityLevel,
        relationshipStyle: draft.relationshipStyle
      },
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
    <PageShell>
      <div className="grid min-h-[calc(100vh-7rem)] gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <form onSubmit={onSubmit} className="app-surface overflow-hidden">
          <div className="border-b border-white/[0.045] p-5 sm:p-7">
            <PageHeader
              icon={Bot}
              title="Create a character"
              description="A guided studio for shaping the persona, first scene, and conversation style without wrestling a raw prompt form."
              actions={
                <div className="flex flex-wrap gap-2">
                  {steps.map(({ label }, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setStep(index)}
                      className={cn(
                        "focus-ring rounded-full border px-4 py-2 text-sm font-medium transition",
                        step === index
                          ? "border-primary/25 bg-primary/[0.1] text-[#e5ddff]"
                          : "border-white/[0.045] bg-white/[0.028] text-muted-foreground hover:border-primary/20 hover:bg-primary/[0.075] hover:text-foreground"
                      )}
                    >
                      {index + 1}. {label}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="mt-6 rounded-[26px] border border-white/[0.045] bg-white/[0.025] p-4 shadow-inset">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Step {step + 1} of {steps.length}: {steps[step].label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{steps[step].hint}</p>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.055] sm:w-44">
                  <div className="h-full rounded-full primary-gradient transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {step === 0 ? <BasicsStep draft={draft} update={update} /> : null}
            {step === 1 ? <PersonalityStep draft={draft} update={update} /> : null}
            {step === 2 ? <SettingsStep draft={draft} update={update} /> : null}

            {error ? <p className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

            <div className="mt-7 flex items-center justify-between border-t border-white/[0.045] pt-5">
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

        <aside className="app-surface h-fit p-5 xl:sticky xl:top-24">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Live preview</h2>
          </div>
          <div className="mt-5 overflow-hidden rounded-[30px] border border-white/[0.055] bg-[#15111f] shadow-inset">
            <div className="h-24 bg-gradient-to-br from-primary/30 via-[#282039] to-[#15111f]" />
            <div className="p-5 pt-0">
              <CharacterAvatar name={draft.name} avatarUrl={draft.avatarUrl} size="xl" className="-mt-14 border-2 border-[#15111f]" />
              <h3 className="mt-4 truncate text-2xl font-semibold tracking-tight">{draft.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{draft.role}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tagList.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
              <PreviewSection title="Description">{draft.description}</PreviewSection>
              <PreviewSection title="Persona">{`${draft.relationshipStyle} - ${draft.emotionalTone}`}</PreviewSection>
              <PreviewSection title="Personality">{draft.personality}</PreviewSection>
              <PreviewSection title="Scenario">{draft.scenario}</PreviewSection>
              <div className="mt-4 rounded-3xl border border-white/[0.055] bg-white/[0.032] px-4 py-3 text-sm leading-6 text-muted-foreground shadow-inset">
                {draft.greeting}
              </div>
              <Button type="button" variant="secondary" className="mt-4 w-full">
                Test chat
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function BasicsStep({ draft, update }: { draft: Draft; update: <K extends keyof Draft>(field: K, value: Draft[K]) => void }) {
  return (
    <FormSection title="Basics" description="Start with what a person should understand before they send the first message.">
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="rounded-[30px] border border-dashed border-white/[0.075] bg-white/[0.025] p-5 text-center shadow-inset transition hover:border-primary/25 hover:bg-primary/[0.07]">
          <div className="mx-auto grid h-[120px] w-[120px] place-items-center overflow-hidden rounded-full border border-primary/[0.18] bg-primary/[0.075] text-primary">
            {draft.avatarUrl ? <img src={draft.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Upload className="h-8 w-8" />}
          </div>
          <p className="mt-4 text-sm font-medium">Avatar</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Paste an image URL to give the character a face.</p>
          <Input className="mt-4" value={draft.avatarUrl} onChange={(event) => update("avatarUrl", event.target.value)} placeholder="Optional image URL" />
        </div>

        <div className="grid gap-4">
          <Field label="Name" helper="A short, memorable name works best.">
            <Input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Mira of the Ash Library" required />
          </Field>
          <Field label="First greeting" helper="Write the message users see before they reply.">
            <Textarea value={draft.greeting} onChange={(event) => update("greeting", event.target.value)} placeholder="First message" required />
          </Field>
          <Field label="Description" helper="Summarize who this character is and why someone would chat with them.">
            <Textarea value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Who is this character?" required />
          </Field>
        </div>
      </div>
    </FormSection>
  );
}

function PersonalityStep({ draft, update }: { draft: Draft; update: <K extends keyof Draft>(field: K, value: Draft[K]) => void }) {
  return (
    <FormSection title="Personality" description="Tune the character's voice, initiative, and emotional range.">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Personality" helper="Traits, boundaries, habits, emotional style.">
            <Textarea value={draft.personality} onChange={(event) => update("personality", event.target.value)} placeholder="Traits, boundaries, habits, emotional style" required />
          </Field>
          <Field label="Scenario / world context" helper="The scene, relationship, or world that frames the first exchange.">
            <Textarea value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} placeholder="World, scene, current situation" />
          </Field>
          <Field label="Tone" helper="A few words that keep replies emotionally consistent.">
            <Input value={draft.tone} onChange={(event) => update("tone", event.target.value)} placeholder="soft, cinematic" />
          </Field>
          <Field label="Role" helper="The identity anchor injected into every model request.">
            <Input value={draft.role} onChange={(event) => update("role", event.target.value)} placeholder="A careful archive keeper, mentor, rival, or companion" />
          </Field>
          <Field label="Personality traits" helper="Comma-separated traits used for consistent behavior.">
            <Input value={draft.traits} onChange={(event) => update("traits", event.target.value)} placeholder="warm, sly, brave, meticulous" />
          </Field>
          <Field label="Speaking style" helper="How the character sounds sentence by sentence.">
            <Textarea value={draft.speakingStyle} onChange={(event) => update("speakingStyle", event.target.value)} placeholder="Voice, rhythm, word choice" />
          </Field>
        </div>

        <SurfaceMuted className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Personality sliders</h3>
          </div>
          <Slider label="Humor" value={draft.humor} onChange={(value) => update("humor", value)} />
          <Slider label="Romance" value={draft.romanceLevel} onChange={(value) => update("romanceLevel", value)} />
          <Slider label="Seriousness" value={draft.seriousness} onChange={(value) => update("seriousness", value)} />
          <Slider label="Initiative" value={draft.initiative} onChange={(value) => update("initiative", value)} />
          <Slider label="Roleplay intensity" value={draft.roleplayIntensity} onChange={(value) => update("roleplayIntensity", value)} />
          <Field label="Emotional tone">
            <Input value={draft.emotionalTone} onChange={(event) => update("emotionalTone", event.target.value)} placeholder="gentle, intense, playful" />
          </Field>
          <Field label="Motivation">
            <Textarea value={draft.motivation} onChange={(event) => update("motivation", event.target.value)} placeholder="What they want from the conversation" />
          </Field>
          <Field label="Boundaries">
            <Textarea value={draft.boundaries} onChange={(event) => update("boundaries", event.target.value)} placeholder="Comma-separated boundaries" />
          </Field>
          <Field label="Behavioral rules">
            <Textarea value={draft.behavioralRules} onChange={(event) => update("behavioralRules", event.target.value)} placeholder="Comma-separated rules for consistency" />
          </Field>
          <Field label="Verbosity">
            <select
              value={draft.verbosityLevel}
              onChange={(event) => update("verbosityLevel", event.target.value as Draft["verbosityLevel"])}
              className="focus-ring h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 text-sm shadow-inset"
            >
              <option value="concise">Concise replies</option>
              <option value="balanced">Balanced replies</option>
              <option value="expressive">Expressive replies</option>
              <option value="immersive">Immersive replies</option>
            </select>
          </Field>
          <Field label="Relationship style">
            <select
              value={draft.relationshipStyle}
              onChange={(event) => update("relationshipStyle", event.target.value as Draft["relationshipStyle"])}
              className="focus-ring h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 text-sm shadow-inset"
            >
              <option value="friend">Friend</option>
              <option value="romantic">Romantic</option>
              <option value="mentor">Mentor</option>
              <option value="rival">Rival</option>
            </select>
          </Field>
          <Field label="Reply length">
            <select
              value={draft.messageLength}
              onChange={(event) => update("messageLength", event.target.value as Draft["messageLength"])}
              className="focus-ring h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 text-sm shadow-inset"
            >
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </Field>
        </SurfaceMuted>
      </div>
    </FormSection>
  );
}

function SettingsStep({ draft, update }: { draft: Draft; update: <K extends keyof Draft>(field: K, value: Draft[K]) => void }) {
  return (
    <FormSection title="Settings" description="Choose how the character is discovered and mark sensitive content clearly.">
      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Tags" helper="Comma-separated discovery tags.">
          <Input value={draft.tags} onChange={(event) => update("tags", event.target.value)} placeholder="fantasy, friend" />
        </Field>

        <SurfaceMuted className="p-5">
          <h3 className="font-semibold">Visibility</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <VisibilityCard icon={Lock} label="Private" selected={draft.visibility === "PRIVATE"} onClick={() => update("visibility", "PRIVATE")} />
            <VisibilityCard icon={Globe} label="Public" selected={draft.visibility === "PUBLIC"} onClick={() => update("visibility", "PUBLIC")} />
            <VisibilityCard icon={Link2} label="Unlisted" selected={draft.visibility === "UNLISTED"} onClick={() => update("visibility", "UNLISTED")} />
          </div>
        </SurfaceMuted>

        <SurfaceMuted className="p-5 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h3 className="font-semibold">Mature content</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Use the warning state for age-gated or sensitive characters.</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.isNSFW}
              onClick={() => update("isNSFW", !draft.isNSFW)}
              className={cn("focus-ring relative h-8 w-14 rounded-full transition", draft.isNSFW ? "bg-destructive" : "bg-white/[0.12]")}
            >
              <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white transition", draft.isNSFW ? "left-7" : "left-1")} />
            </button>
          </div>
        </SurfaceMuted>
      </div>
    </FormSection>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold leading-8 tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {helper ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{helper}</span> : null}
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
        "focus-ring rounded-3xl border p-4 text-left transition",
        selected
          ? "border-primary/25 bg-primary/[0.11] text-[#e5ddff]"
          : "border-white/[0.055] bg-white/[0.028] text-muted-foreground hover:border-primary/20 hover:bg-primary/[0.075]"
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
      <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}

function splitList(value: string, limit: number) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}
