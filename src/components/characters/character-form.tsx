"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Bot,
  Globe,
  ImagePlus,
  Lock,
  MessageSquare,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
  X,
  Zap
} from "lucide-react";
import { CharacterPreviewPanel } from "@/components/characters/character-preview-panel";
import { FormAccordionSection } from "@/components/characters/form-accordion-section";
import { PromptGeneratorPanel, type PromptGeneratorOptions } from "@/components/characters/prompt-generator-panel";
import { TagChipInput } from "@/components/characters/tag-chip-input";
import { Button } from "@/components/ui/button";
import { ImageFilePicker } from "@/components/ui/image-file-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applyPromptGenerationToDraft,
  buildCharacterCreatePayload,
  firstValidationIssue,
  normalizeInitialCharacterValue,
  promptPreviewFromGeneration,
  validateCharacterCreatePayload
} from "@/lib/character-form-payload";
import {
  CUSTOM_SECTIONS,
  VIBE_PRESETS,
  type CharacterFormInitialValue,
  type CharacterFormValue,
  type CustomSectionId,
  type GeneratedCharacterPreview,
  type PromptGenerationMeta
} from "@/lib/character-form-types";
import { cn } from "@/lib/utils";

type CharacterFormProps = {
  mode: "create" | "edit";
  initialValue?: CharacterFormInitialValue;
};

type CreationMode = "simple" | "custom" | "prompt";

const sectionIcons = {
  basics: Bot,
  personality: MessageSquare,
  scenario: BookOpen,
  speaking: Palette,
  advanced: ShieldCheck
} as const;

export function CharacterForm({ mode, initialValue }: CharacterFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<CharacterFormValue>(() => normalizeInitialCharacterValue(initialValue));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [assistingSection, setAssistingSection] = useState<CustomSectionId | null>(null);
  const [formMode, setFormMode] = useState<CreationMode>(() => (mode === "edit" ? "custom" : "simple"));
  const [openSections, setOpenSections] = useState<Record<CustomSectionId, boolean>>({
    basics: true,
    personality: false,
    scenario: false,
    speaking: false,
    advanced: false
  });
  const [generatedPreview, setGeneratedPreview] = useState<GeneratedCharacterPreview | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generationMeta, setGenerationMeta] = useState<PromptGenerationMeta | null>(null);
  const [promptGenerated, setPromptGenerated] = useState(false);
  const [promptOptions, setPromptOptions] = useState<PromptGeneratorOptions | null>(null);

  const isSimpleMode = mode === "create" && formMode === "simple";
  const isPromptMode = mode === "create" && formMode === "prompt";
  const previewDraft = useMemo(
    () => (generatedPreview ? mergePreviewIntoDraft(draft, generatedPreview) : draft),
    [draft, generatedPreview]
  );

  const canSubmit = isPromptMode
    ? promptGenerated && draft.name.trim().length >= 2 && draft.description.trim().length >= 10
    : draft.name.trim().length >= 2 && draft.description.trim().length >= 10;
  const canGeneratePreview = !isPromptMode && draft.name.trim().length >= 2 && draft.description.trim().length >= 10;

  function update<K extends keyof CharacterFormValue>(field: K, value: CharacterFormValue[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (formMode === "simple") {
      setGeneratedPreview(null);
    }
  }

  function switchFormMode(nextMode: CreationMode) {
    if (nextMode === "custom" && generatedPreview) {
      setDraft((current) => mergePreviewIntoDraft(current, generatedPreview));
    }
    if (nextMode === "custom" && promptGenerated) {
      setOpenSections({
        basics: true,
        personality: true,
        scenario: true,
        speaking: true,
        advanced: false
      });
    }
    setFormMode(nextMode);
    setError(null);
  }

  async function generateFromPrompt(options: PromptGeneratorOptions) {
    if (prompt.trim().length < 12) {
      setError("Write at least 12 characters in your prompt.");
      return;
    }

    if (!options.provider.trim() || !options.model.trim()) {
      setError("Choose a provider and model before generating.");
      return;
    }

    setGeneratingPreview(true);
    setError(null);
    setPromptOptions(options);

    try {
      const response = await fetch("/api/characters/generate-from-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          provider: options.provider,
          model: options.model
        })
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not generate character from prompt.");
        return;
      }

      const generated = body?.generated;
      if (!generated) {
        setError("Could not generate character from prompt.");
        return;
      }

      setDraft((current) => applyPromptGenerationToDraft(current, generated));
      setGeneratedPreview(promptPreviewFromGeneration(generated));
      setGenerationMeta({
        source: generated.source,
        provider: generated.provider
      });
      setPromptGenerated(true);
    } catch {
      setError("Could not generate character from prompt.");
    } finally {
      setGeneratingPreview(false);
    }
  }

  function toggleSection(section: CustomSectionId) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  }

  async function generatePreview() {
    if (!canGeneratePreview) {
      return;
    }

    setGeneratingPreview(true);
    setError(null);

    try {
      const response = await fetch("/api/characters/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          description: draft.description.trim()
        })
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Could not generate preview.");
        return;
      }

      const body = await response.json();
      const generated = body?.generated;
      if (!generated) {
        setError("Could not generate preview.");
        return;
      }

      setGeneratedPreview({
        personality: generated.personality,
        scenario: generated.scenario,
        greeting: generated.greeting,
        tags: Array.isArray(generated.tags) ? generated.tags : draft.tags,
        persona: generated.persona ?? null,
        communicationStyle: generated.communicationStyle ?? null
      });
    } catch {
      setError("Could not generate preview.");
    } finally {
      setGeneratingPreview(false);
    }
  }

  async function assistSection(section: CustomSectionId) {
    if (!canSubmit) {
      setError("Add a name and short description before using AI Assist.");
      return;
    }

    setAssistingSection(section);
    setError(null);

    try {
      const response = await fetch("/api/characters/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section,
          name: draft.name.trim(),
          description: draft.description.trim(),
          context: buildAssistContext(draft)
        })
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "AI Assist failed.");
        return;
      }

      const body = await response.json();
      const suggestions = body?.suggestions ?? {};
      setDraft((current) => applyAssistSuggestions(current, suggestions));
    } catch {
      setError("AI Assist failed.");
    } finally {
      setAssistingSection(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    let preview = generatedPreview;

    if (isPromptMode && !preview) {
      setSaving(false);
      setError("Generate a character from your prompt before creating.");
      return;
    }

    if (isSimpleMode && !preview) {
      try {
        const response = await fetch("/api/characters/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: draft.name.trim(),
            description: draft.description.trim()
          })
        });

        if (response.status === 401) {
          setSaving(false);
          router.push("/login");
          return;
        }

        if (response.ok) {
          const body = await response.json().catch(() => null);
          const generated = body?.generated;
          if (generated) {
            preview = {
              personality: generated.personality,
              scenario: generated.scenario,
              greeting: generated.greeting,
              tags: Array.isArray(generated.tags) ? generated.tags : draft.tags,
              persona: generated.persona ?? null,
              communicationStyle: generated.communicationStyle ?? null
            };
          }
        }
      } catch {
        preview = null;
      }
    }

    if (!isSimpleMode && draft.visibility === "PUBLIC" && !draft.avatarUrl.trim()) {
      setSaving(false);
      setError("Add an avatar before publishing publicly, or save the character as private.");
      return;
    }

    const payload = buildCharacterCreatePayload({
      draft,
      generated: preview,
      isSimpleMode: isSimpleMode || isPromptMode
    });

    const validation = validateCharacterCreatePayload(payload);
    if (!validation.success) {
      setSaving(false);
      setError(firstValidationIssue(validation) ?? "Invalid request body.");
      return;
    }

    const url = mode === "edit" && draft.id ? `/api/characters/${draft.id}` : "/api/characters";
    const response = await fetch(url, {
      method: mode === "edit" ? "PATCH" : "POST",
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
      const issueMessage = firstIssueMessage(body?.issues);
      setError(issueMessage ? `${body?.error ?? "Could not save character."} ${issueMessage}` : body?.error ?? "Could not save character.");
      return;
    }

    const body = await response.json();
    router.push(`/character/${body.character.id}`);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,680px)_minmax(300px,1fr)] lg:items-start">
      <form onSubmit={onSubmit} className="grid min-w-0 gap-5">
        {mode === "create" ? (
          <div className="glass-panel grid grid-cols-3 gap-2 p-2">
            <ModeButton label="Prompt" icon={Zap} active={isPromptMode} onClick={() => switchFormMode("prompt")} />
            <ModeButton label="Simple" icon={Wand2} active={isSimpleMode} onClick={() => switchFormMode("simple")} />
            <ModeButton label="Custom" icon={SlidersHorizontal} active={formMode === "custom"} onClick={() => switchFormMode("custom")} />
          </div>
        ) : null}

        {isPromptMode ? (
          <>
            <PromptGeneratorPanel
              prompt={prompt}
              onPromptChange={(value) => {
                setPrompt(value);
                setPromptGenerated(false);
                setGenerationMeta(null);
                setPromptOptions(null);
              }}
              onGenerate={generateFromPrompt}
              generating={generatingPreview}
              generationMeta={generationMeta}
            />

            {promptGenerated ? (
              <section className="glass-panel grid gap-4 p-5 sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Generated draft</p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Review and tweak</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Everything below was created from your prompt. Edit anything before saving.</p>
                </div>

                <Field label="Avatar">
                  <AvatarUpload value={draft.avatarUrl} name={draft.name} onChange={(value) => update("avatarUrl", value)} onError={setError} />
                </Field>

                <Field label="Character name" required>
                  <Input value={draft.name} onChange={(event) => update("name", event.target.value)} required />
                </Field>

                <Field label="Description" required>
                  <Textarea value={draft.description} onChange={(event) => update("description", event.target.value)} required />
                </Field>

                <Field label="Tags">
                  <TagChipInput value={draft.tags} onChange={(tags) => update("tags", tags)} presets={VIBE_PRESETS} />
                </Field>

                {generatedPreview ? <GeneratedPreviewCard preview={generatedPreview} /> : null}
              </section>
            ) : null}
          </>
        ) : isSimpleMode ? (
          <section className="glass-panel grid gap-5 p-5 sm:p-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Quick create</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Shape your character</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                  Add the essentials, pick a vibe, then let AI flesh out the rest when you are ready.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={generatePreview} disabled={!canGeneratePreview || generatingPreview}>
                <Sparkles className="h-4 w-4" />
                {generatingPreview ? "Generating..." : "Generate preview"}
              </Button>
            </header>

            <Field label="Avatar">
              <AvatarUpload value={draft.avatarUrl} name={draft.name} onChange={(value) => update("avatarUrl", value)} onError={setError} />
            </Field>

            <Field label="Character name" required>
              <Input
                value={draft.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="A unique name for your character"
                required
              />
            </Field>

            <Field label="Core idea" required>
              <Textarea
                value={draft.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Who are they, what vibe do they have, and why would someone want to chat with them?"
                required
              />
            </Field>

            <Field label="Vibe tags">
              <TagChipInput value={draft.tags} onChange={(tags) => update("tags", tags)} presets={VIBE_PRESETS} />
            </Field>

            <Field label="Example greeting" hint="Optional, but helps the preview feel more personal.">
              <Textarea
                value={draft.greeting}
                onChange={(event) => update("greeting", event.target.value)}
                placeholder="The first message your character might send."
                className="min-h-28"
              />
            </Field>

            {generatedPreview ? (
              <GeneratedPreviewCard preview={generatedPreview} />
            ) : null}
          </section>
        ) : (
          <div className="grid gap-4">
            {CUSTOM_SECTIONS.map((section) => {
              const Icon = sectionIcons[section.id];
              return (
                <FormAccordionSection
                  key={section.id}
                  id={section.id}
                  title={section.title}
                  description={section.description}
                  icon={Icon}
                  open={openSections[section.id]}
                  onToggle={() => toggleSection(section.id)}
                  onAssist={() => assistSection(section.id)}
                  assisting={assistingSection === section.id}
                >
                  {section.id === "basics" ? (
                    <>
                      <Field label="Character name" required>
                        <Input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ari the Archivist" required />
                      </Field>
                      <Field label="Description" required>
                        <Textarea
                          value={draft.description}
                          onChange={(event) => update("description", event.target.value)}
                          placeholder="A soft-spoken fantasy guide with a sharp memory."
                          required
                        />
                      </Field>
                      <Field label="Tags">
                        <TagChipInput value={draft.tags} onChange={(tags) => update("tags", tags)} placeholder="Type any tag and press Enter" />
                      </Field>
                      <Field label="Avatar">
                        <AvatarUpload value={draft.avatarUrl} name={draft.name} onChange={(value) => update("avatarUrl", value)} onError={setError} large />
                      </Field>
                    </>
                  ) : null}

                  {section.id === "personality" ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Role">
                          <Input value={draft.personaRole} onChange={(event) => update("personaRole", event.target.value)} placeholder="Mentor, rival, companion..." />
                        </Field>
                        <Field label="Archetype">
                          <Input value={draft.archetype} onChange={(event) => update("archetype", event.target.value)} placeholder="Archivist, detective, bard..." />
                        </Field>
                      </div>
                      <Field label="Personality">
                        <Textarea
                          value={draft.personality}
                          onChange={(event) => update("personality", event.target.value)}
                          placeholder="How they think, react, and carry themselves."
                          className="min-h-32"
                        />
                      </Field>
                      <Field label="Traits">
                        <Textarea value={draft.personaTraits} onChange={(event) => update("personaTraits", event.target.value)} placeholder="One trait per line." />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Relationship style">
                          <Input value={draft.relationshipStyle} onChange={(event) => update("relationshipStyle", event.target.value)} placeholder="friend, romantic, mentor..." />
                        </Field>
                        <Field label="Initiative">
                          <Input value={draft.initiativeLevel} onChange={(event) => update("initiativeLevel", event.target.value)} placeholder="low, medium, high" />
                        </Field>
                        <Field label="Verbosity">
                          <Input value={draft.verbosityLevel} onChange={(event) => update("verbosityLevel", event.target.value)} placeholder="concise, balanced, expressive..." />
                        </Field>
                      </div>
                      <Field label="Motivation">
                        <Textarea value={draft.motivation} onChange={(event) => update("motivation", event.target.value)} placeholder="What they want from scenes and conversations." />
                      </Field>
                    </>
                  ) : null}

                  {section.id === "scenario" ? (
                    <>
                      <Field label="Scenario / world">
                        <Textarea
                          value={draft.scenario}
                          onChange={(event) => update("scenario", event.target.value)}
                          placeholder="Where the scene starts and what should stay true."
                          className="min-h-32"
                        />
                      </Field>
                      <Field label="Greeting">
                        <Textarea
                          value={draft.greeting}
                          onChange={(event) => update("greeting", event.target.value)}
                          placeholder="The first message users will see."
                          className="min-h-28"
                        />
                      </Field>
                    </>
                  ) : null}

                  {section.id === "speaking" ? (
                    <>
                      <Field label="Speaking style">
                        <Textarea value={draft.speakingStyle} onChange={(event) => update("speakingStyle", event.target.value)} placeholder="How the character sounds in conversation." />
                      </Field>
                      <Field label="Emotional tone">
                        <Input value={draft.emotionalTone} onChange={(event) => update("emotionalTone", event.target.value)} placeholder="attentive, playful, distant..." />
                      </Field>
                      <Field label="Tone">
                        <Input value={draft.tone} onChange={(event) => update("tone", event.target.value)} placeholder="warm, dry, intense..." />
                      </Field>
                      <Field label="Message length">
                        <Input value={draft.messageLength} onChange={(event) => update("messageLength", event.target.value)} placeholder="short, medium, long" />
                      </Field>
                    </>
                  ) : null}

                  {section.id === "advanced" ? (
                    <>
                      <Field label="Boundaries">
                        <Textarea value={draft.boundaries} onChange={(event) => update("boundaries", event.target.value)} />
                      </Field>
                      <Field label="Behavioral rules">
                        <Textarea value={draft.behavioralRules} onChange={(event) => update("behavioralRules", event.target.value)} />
                      </Field>
                      <Field label="Forbidden behaviors">
                        <Textarea value={draft.forbiddenBehaviors} onChange={(event) => update("forbiddenBehaviors", event.target.value)} />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Slider label="Humor" value={draft.humor} onChange={(value) => update("humor", value)} />
                        <Slider label="Romance" value={draft.romanceLevel} onChange={(value) => update("romanceLevel", value)} />
                        <Slider label="Seriousness" value={draft.seriousness} onChange={(value) => update("seriousness", value)} />
                        <Slider label="Initiative" value={draft.initiative} onChange={(value) => update("initiative", value)} />
                        <Slider label="Roleplay intensity" value={draft.roleplayIntensity} onChange={(value) => update("roleplayIntensity", value)} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--bg-input)] p-1">
                        <VisibilityButton icon={Lock} label="Private" selected={draft.visibility === "PRIVATE"} onClick={() => update("visibility", "PRIVATE")} />
                        <VisibilityButton icon={Globe} label="Unlisted" selected={draft.visibility === "UNLISTED"} onClick={() => update("visibility", "UNLISTED")} />
                        <VisibilityButton icon={Globe} label="Public" selected={draft.visibility === "PUBLIC"} onClick={() => update("visibility", "PUBLIC")} />
                      </div>
                      <label className="flex min-h-12 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] px-4 text-sm text-[var(--text-secondary)] backdrop-blur-xl">
                        <input type="checkbox" checked={draft.isNSFW} onChange={(event) => update("isNSFW", event.target.checked)} className="accent-[var(--accent-purple)]" />
                        Mark as age-gated / NSFW
                      </label>
                    </>
                  ) : null}
                </FormAccordionSection>
              );
            })}
          </div>
        )}

        {error ? <p className="rounded-[var(--radius-md)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}

        <div className="glass-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          {isPromptMode ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => promptOptions && void generateFromPrompt(promptOptions)}
                disabled={generatingPreview || prompt.trim().length < 12 || !promptOptions}
              >
                <Sparkles className="h-4 w-4" />
                Regenerate
              </Button>
              <Button type="button" variant="outline" onClick={() => switchFormMode("custom")} disabled={!promptGenerated}>
                <SlidersHorizontal className="h-4 w-4" />
                Open in Custom
              </Button>
            </div>
          ) : isSimpleMode ? (
            <Button type="button" variant="outline" onClick={() => switchFormMode("custom")}>
              <SlidersHorizontal className="h-4 w-4" />
              Customize
            </Button>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Fill sections in any order. AI Assist can help inside each block.</p>
          )}
          <Button type="submit" size="lg" disabled={saving || !canSubmit}>
            <Save className="h-4 w-4" />
            {saving ? (mode === "edit" ? "Saving..." : "Creating...") : mode === "edit" ? "Save character" : "Create character"}
          </Button>
        </div>
      </form>

      <CharacterPreviewPanel
        name={previewDraft.name}
        description={previewDraft.description}
        greeting={previewDraft.greeting}
        avatarUrl={previewDraft.avatarUrl}
        tags={previewDraft.tags}
        generated={Boolean(generatedPreview)}
      />
    </div>
  );
}

function mergePreviewIntoDraft(draft: CharacterFormValue, preview: GeneratedCharacterPreview): CharacterFormValue {
  const persona = preview.persona ?? {};
  const style = preview.communicationStyle ?? {};

  return {
    ...draft,
    name: draft.name.trim() || preview.name || draft.name,
    description: draft.description.trim() || preview.description || draft.description,
    personality: draft.personality.trim() || preview.personality,
    scenario: draft.scenario.trim() || preview.scenario,
    greeting: draft.greeting.trim() || preview.greeting,
    tags: draft.tags.length > 1 || (draft.tags[0] && draft.tags[0] !== "roleplay") ? draft.tags : preview.tags,
    isNSFW: preview.isNSFW ?? draft.isNSFW,
    personaRole: draft.personaRole.trim() || String(persona.role ?? ""),
    archetype: draft.archetype.trim() || String(persona.archetype ?? ""),
    speakingStyle: draft.speakingStyle.trim() || String(persona.speakingStyle ?? ""),
    emotionalTone: draft.emotionalTone.trim() || String(persona.emotionalTone ?? ""),
    tone: draft.tone.trim() || String(style.tone ?? "")
  };
}

function buildAssistContext(draft: CharacterFormValue) {
  return {
    description: draft.description,
    personality: draft.personality,
    scenario: draft.scenario,
    greeting: draft.greeting,
    personaRole: draft.personaRole,
    archetype: draft.archetype,
    personaTraits: draft.personaTraits,
    speakingStyle: draft.speakingStyle,
    emotionalTone: draft.emotionalTone,
    motivation: draft.motivation,
    boundaries: draft.boundaries,
    behavioralRules: draft.behavioralRules,
    forbiddenBehaviors: draft.forbiddenBehaviors,
    tone: draft.tone
  };
}

function applyAssistSuggestions(draft: CharacterFormValue, suggestions: Record<string, string>): CharacterFormValue {
  return {
    ...draft,
    description: suggestions.description?.trim() || draft.description,
    personality: suggestions.personality?.trim() || draft.personality,
    scenario: suggestions.scenario?.trim() || draft.scenario,
    greeting: suggestions.greeting?.trim() || draft.greeting,
    personaRole: suggestions.personaRole?.trim() || draft.personaRole,
    archetype: suggestions.archetype?.trim() || draft.archetype,
    personaTraits: suggestions.personaTraits?.trim() || draft.personaTraits,
    speakingStyle: suggestions.speakingStyle?.trim() || draft.speakingStyle,
    emotionalTone: suggestions.emotionalTone?.trim() || draft.emotionalTone,
    motivation: suggestions.motivation?.trim() || draft.motivation,
    boundaries: suggestions.boundaries?.trim() || draft.boundaries,
    behavioralRules: suggestions.behavioralRules?.trim() || draft.behavioralRules,
    forbiddenBehaviors: suggestions.forbiddenBehaviors?.trim() || draft.forbiddenBehaviors,
    tone: suggestions.tone?.trim() || draft.tone
  };
}

function GeneratedPreviewCard({ preview }: { preview: GeneratedCharacterPreview }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--accent-rgb)_/_0.28)] bg-[var(--accent-purple-soft)] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{preview.name?.trim() || "Generated preview"}</p>
      {preview.description ? <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{preview.description}</p> : null}
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Personality</p>
      <p className="mt-1 line-clamp-4 text-sm leading-6 text-[var(--text-secondary)]">{preview.personality}</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Opening message</p>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">{preview.greeting}</p>
    </div>
  );
}

function AvatarUpload({
  value,
  name,
  onChange,
  onError,
  large = false
}: {
  value: string;
  name: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
  large?: boolean;
}) {
  return (
    <div>
      <ImageFilePicker onPick={onChange} onError={onError}>
        <div
          className={cn(
            "focus-ring flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] p-5 text-center transition hover:border-[var(--accent-purple)] hover:bg-white/[0.045]",
            large ? "min-h-[210px]" : "min-h-28"
          )}
        >
          <span
            className={cn(
              "grid place-items-center overflow-hidden rounded-full border border-white/10 bg-[var(--bg-elevated)] text-[var(--accent-purple)] shadow-[var(--shadow-glow)]",
              large ? "h-32 w-32" : "h-20 w-20"
            )}
          >
            {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : large ? <Upload className="h-8 w-8" /> : <ImagePlus className="h-5 w-5" />}
          </span>
          <span className="mt-3 text-sm text-[var(--text-secondary)]">{value ? "Click to replace image" : "Upload an avatar image"}</span>
        </div>
      </ImageFilePicker>
      {value ? (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onChange("")}>
          <X className="h-4 w-4" />
          Clear image
        </Button>
      ) : null}
      {!value && name.trim() ? <p className="mt-2 text-xs text-[var(--text-muted)]">No image yet — a generated initial will be used in preview.</p> : null}
    </div>
  );
}

function ModeButton({
  label,
  icon: Icon,
  active,
  onClick
}: {
  label: string;
  icon: typeof Wand2;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex h-12 items-center justify-center gap-2 rounded-[var(--radius-pill)] text-sm font-semibold transition-colors duration-150 active:scale-95",
        active
          ? "bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-secondary)] text-white shadow-[var(--shadow-glow)]"
          : "text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  required,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {label}
        {required ? <span className="text-[var(--accent-purple)]"> *</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-xs text-[var(--text-muted)]">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-medium text-[var(--text-primary)]">
        {label}
        <span className="text-[var(--text-secondary)]">{value}/10</span>
      </span>
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[var(--accent-purple)]"
      />
    </label>
  );
}

function VisibilityButton({
  icon: Icon,
  label,
  selected,
  onClick
}: {
  icon: typeof Lock;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex h-10 items-center justify-center gap-2 rounded-[var(--radius-pill)] text-sm font-medium transition-colors duration-150 active:scale-95",
        selected ? "bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-secondary)] text-white" : "text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function firstIssueMessage(issues: unknown) {
  if (!issues || typeof issues !== "object") {
    return null;
  }

  const fieldErrors = "fieldErrors" in issues ? (issues as { fieldErrors?: Record<string, string[]> }).fieldErrors : null;
  if (!fieldErrors) {
    return null;
  }

  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages?.find(Boolean);
    if (message) {
      return `${field}: ${message}`;
    }
  }

  return null;
}

export type { CharacterFormInitialValue };