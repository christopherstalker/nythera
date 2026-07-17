"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  ImagePlus,
  Download,
  FileJson,
  Lock,
  Save,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
  X,
  Zap
} from "lucide-react";
import { CharacterPreviewPanel } from "@/components/characters/character-preview-panel";
import { PromptGeneratorPanel, type PromptGeneratorOptions } from "@/components/characters/prompt-generator-panel";
import { TagChipInput } from "@/components/characters/tag-chip-input";
import { Button } from "@/components/ui/button";
import { ImageFilePicker } from "@/components/ui/image-file-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applyPromptGenerationToDraft,
  buildCharacterCreatePayload,
  creationModeForEditor,
  creationModeForNewCharacter,
  firstValidationIssue,
  lorebookToText,
  normalizeInitialCharacterValue,
  promptPreviewFromGeneration,
  validateCharacterCreatePayload
} from "@/lib/character-form-payload";
import {
  VIBE_PRESETS,
  type CharacterFormInitialValue,
  type CharacterFormMode,
  type CharacterFormValue,
  type CustomSectionId,
  type GeneratedCharacterPreview,
  type PromptGenerationMeta
} from "@/lib/character-form-types";
import { cn } from "@/lib/utils";
import { FIRST_CLASS_PROVIDER_PRESETS } from "@/lib/provider-presets";

type CharacterFormProps = {
  mode: "create" | "edit";
  initialValue?: CharacterFormInitialValue;
};

type ProviderOption = {
  provider: string;
  displayName: string;
  defaultModel: string;
};

type StudioChapterId = "identity" | "voice" | "scene" | "lore" | "appearance" | "publishing";

const studioChapters: Array<{ id: StudioChapterId; number: string; label: string }> = [
  { id: "identity", number: "01", label: "Identity" },
  { id: "voice", number: "02", label: "Voice & personality" },
  { id: "scene", number: "03", label: "Scene & first message" },
  { id: "lore", number: "04", label: "Lore & memory" },
  { id: "appearance", number: "05", label: "Visual language" },
  { id: "publishing", number: "06", label: "Behavior & publishing" }
];

export function CharacterForm({ mode, initialValue }: CharacterFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<CharacterFormValue>(() => normalizeInitialCharacterValue(initialValue));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [assistingSection, setAssistingSection] = useState<CustomSectionId | null>(null);
  const [formMode, setFormMode] = useState<CharacterFormMode>(() =>
    mode === "edit" ? creationModeForEditor(initialValue?.creationMode) : "simple"
  );
  const [activeChapter, setActiveChapter] = useState<StudioChapterId>("identity");
  const [generatedPreview, setGeneratedPreview] = useState<GeneratedCharacterPreview | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generationMeta, setGenerationMeta] = useState<PromptGenerationMeta | null>(null);
  const [promptGenerated, setPromptGenerated] = useState(false);
  const [promptOptions, setPromptOptions] = useState<PromptGeneratorOptions | null>(null);
  const [savedProviderOptions, setSavedProviderOptions] = useState<ProviderOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadKeys() {
      try {
        const response = await fetch("/api/keys", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const body = await response.json();
        if (cancelled || !Array.isArray(body?.keys)) {
          return;
        }

        setSavedProviderOptions(
          body.keys.map((key: ProviderOption) => ({
            provider: key.provider,
            displayName: key.displayName,
            defaultModel: key.defaultModel || ""
          }))
        );
      } catch {}
    }

    void loadKeys();

    return () => {
      cancelled = true;
    };
  }, []);

  const providerOptions = useMemo(() => {
    const options = new Map<string, ProviderOption>();
    for (const preset of FIRST_CLASS_PROVIDER_PRESETS) {
      options.set(preset.provider, preset);
    }
    for (const provider of savedProviderOptions) {
      options.set(provider.provider, provider);
    }
    return [...options.values()];
  }, [savedProviderOptions]);

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
    if (formMode === "simple" && field !== "greeting" && field !== "avatarUrl" && field !== "tags") {
      setGeneratedPreview(null);
    }
  }

  function switchFormMode(nextMode: CharacterFormMode) {
    if (nextMode === "custom" && generatedPreview) {
      setDraft((current) => mergePreviewIntoDraft(current, generatedPreview));
    }
    if (nextMode === "custom" && promptGenerated) setActiveChapter("identity");
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

  function selectChapter(chapter: StudioChapterId) {
    setActiveChapter(chapter);
    requestAnimationFrame(() => {
      document.getElementById(`studio-${chapter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function exportCharacterCard() {
    const payload = buildCharacterCreatePayload({
      draft,
      generated: generatedPreview,
      isSimpleMode: false,
      creationMode: mode === "edit" ? creationModeForEditor(initialValue?.creationMode) : creationModeForNewCharacter(formMode)
    });
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: payload.name,
        description: payload.description,
        personality: payload.personality,
        scenario: payload.scenario,
        first_mes: payload.greeting,
        avatar: payload.avatarUrl,
        tags: payload.tags,
        creator_notes: JSON.stringify({
          persona: payload.persona ?? null,
          communicationStyle: payload.communicationStyle ?? null,
          lorebook: payload.lorebook ?? null,
          visualIdentity: payload.visualIdentity ?? null
        })
      }
    };

    update("characterCardJson", JSON.stringify(card, null, 2));
    setError(null);
  }

  function importCharacterCard() {
    try {
      const parsed = JSON.parse(draft.characterCardJson);
      const data = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
      const notes = parseCreatorNotes(data?.creator_notes);
      setDraft((current) => ({
        ...current,
        name: textFromCard(data?.name, current.name),
        description: textFromCard(data?.description, current.description),
        personality: textFromCard(data?.personality, current.personality),
        scenario: textFromCard(data?.scenario, current.scenario),
        greeting: textFromCard(data?.first_mes ?? data?.mes_example, current.greeting),
        avatarUrl: textFromCard(data?.avatar, current.avatarUrl),
        tags: Array.isArray(data?.tags) ? data.tags.map(String).filter(Boolean).slice(0, 12) : current.tags,
        personaRole: textFromCard(notes.persona?.role, current.personaRole),
        archetype: textFromCard(notes.persona?.archetype, current.archetype),
        personaTraits: Array.isArray(notes.persona?.personalityTraits) ? notes.persona.personalityTraits.join("\n") : current.personaTraits,
        speakingStyle: textFromCard(notes.persona?.speakingStyle, current.speakingStyle),
        emotionalTone: textFromCard(notes.persona?.emotionalTone, current.emotionalTone),
        lorebookText: notes.lorebook ? lorebookToText(notes.lorebook) : current.lorebookText,
        visualAccentColor: textFromCard(notes.visualIdentity?.accentColor, current.visualAccentColor),
        visualGradientFrom: textFromCard(notes.visualIdentity?.gradientFrom, current.visualGradientFrom),
        visualGradientTo: textFromCard(notes.visualIdentity?.gradientTo, current.visualGradientTo),
        visualChatBackground: textFromCard(notes.visualIdentity?.chatBackground, current.visualChatBackground)
      }));
      setError(null);
    } catch {
      setError("Paste valid Character Card V2 JSON before importing.");
    }
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
          description: draft.description.trim(),
          greeting: draft.greeting.trim() || undefined
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
        greeting: draft.greeting.trim() || generated.greeting,
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
            description: draft.description.trim(),
            greeting: draft.greeting.trim() || undefined
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
              greeting: draft.greeting.trim() || generated.greeting,
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
      isSimpleMode: isSimpleMode || isPromptMode,
      creationMode: mode === "edit" ? creationModeForEditor(initialValue?.creationMode) : creationModeForNewCharacter(formMode)
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

  const visibleChapters = isSimpleMode
    ? studioChapters.filter((chapter) => ["identity", "scene", "publishing"].includes(chapter.id))
    : studioChapters;
  const currentChapterIndex = Math.max(0, visibleChapters.findIndex((chapter) => chapter.id === activeChapter));
  const completedCoreFields = [draft.name, draft.description, draft.greeting, draft.personality, draft.scenario, draft.avatarUrl].filter((value) => value.trim()).length;
  const completion = Math.round((completedCoreFields / 6) * 100);

  return (
    <div className="codex-character-studio character-editor-surfaces min-h-full">
      <CharacterPreviewPanel
        className="codex-character-dossier"
        name={previewDraft.name}
        description={previewDraft.description}
        greeting={previewDraft.greeting}
        avatarUrl={previewDraft.avatarUrl}
        tags={previewDraft.tags}
        generated={Boolean(generatedPreview)}
        mode={mode}
        completion={completion}
        activeChapter={activeChapter}
        chapters={visibleChapters}
        onChapterChange={(chapter) => selectChapter(chapter as StudioChapterId)}
        visualIdentity={{
          accentColor: previewDraft.visualAccentColor,
          gradientFrom: previewDraft.visualGradientFrom,
          gradientTo: previewDraft.visualGradientTo
        }}
      />

      <form onSubmit={onSubmit} className="codex-manuscript chat-scroll min-w-0 overflow-y-auto">
        <header className="codex-studio-header">
          <div>
            <p className="codex-kicker">{mode === "edit" ? "Character archive / revision" : "New volume / character studio"}</p>
            <h1 className="font-editorial mt-3 text-[clamp(2.8rem,6vw,5.25rem)] font-medium leading-[.84] tracking-[-.04em] text-[var(--codex-ivory)]">
              {mode === "edit" ? "Revise the dossier" : "Inscribe a living voice"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Move through the manuscript chapter by chapter. The dossier beside it updates as the character takes shape.
            </p>
          </div>

          {mode === "create" ? (
            <div className="codex-mode-index" aria-label="Creation method">
              <ModeButton label="Inscribe" icon={Zap} active={isPromptMode} onClick={() => switchFormMode("prompt")} />
              <ModeButton label="Guided" icon={Wand2} active={isSimpleMode} onClick={() => switchFormMode("simple")} />
              <ModeButton label="Complete" icon={SlidersHorizontal} active={formMode === "custom"} onClick={() => switchFormMode("custom")} />
            </div>
          ) : null}
        </header>

        {isPromptMode ? (
          <section className="codex-prompt-sheet">
            <div className="codex-chapter-heading">
              <span>00</span>
              <div>
                <p className="codex-kicker">Inscribe from prompt</p>
                <h2>Begin with a premise</h2>
                <p>Describe the person, tension, world, and desired relationship. Nythera will draft the complete dossier for review.</p>
              </div>
            </div>
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
              <div className="codex-generated-leaf">
                <p className="codex-kicker">Draft received</p>
                <h3 className="font-editorial mt-2 text-3xl text-[var(--codex-ivory)]">Review the opening leaf</h3>
                <div className="mt-6 grid gap-6">
                  <Field label="Portrait"><AvatarUpload value={draft.avatarUrl} name={draft.name} onChange={(value) => update("avatarUrl", value)} onError={setError} /></Field>
                  <Field label="Character name" required><Input value={draft.name} onChange={(event) => update("name", event.target.value)} required /></Field>
                  <Field label="Essence" required><Textarea value={draft.description} onChange={(event) => update("description", event.target.value)} required /></Field>
                  <Field label="Index terms"><TagChipInput value={draft.tags} onChange={(tags) => update("tags", tags)} presets={VIBE_PRESETS} /></Field>
                  <Field label="First message"><Textarea value={draft.greeting} onChange={(event) => update("greeting", event.target.value)} className="min-h-36" /></Field>
                  {generatedPreview ? <GeneratedPreviewCard preview={generatedPreview} /> : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : isSimpleMode ? (
          <div className="codex-chapter-stack">
            <StudioChapter id="identity" number="01" title="Identity" description="Name the character and define the promise at the center of every conversation." active={activeChapter === "identity"} onSelect={() => selectChapter("identity")} onAssist={() => assistSection("basics")} assisting={assistingSection === "basics"}>
              <Field label="Portrait"><AvatarUpload value={draft.avatarUrl} name={draft.name} onChange={(value) => update("avatarUrl", value)} onError={setError} large /></Field>
              <Field label="Character name" required><Input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ari the Archivist" required /></Field>
              <Field label="Core idea" required><Textarea value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Who are they, what tension follows them, and why should someone stay?" className="min-h-40" required /></Field>
              <Field label="Index terms"><TagChipInput value={draft.tags} onChange={(tags) => update("tags", tags)} presets={VIBE_PRESETS} /></Field>
            </StudioChapter>
            <StudioChapter id="scene" number="02" title="First scene" description="Write the threshold where the relationship begins." active={activeChapter === "scene"} onSelect={() => selectChapter("scene")} onAssist={() => assistSection("greeting")} assisting={assistingSection === "greeting"}>
              <Field label="Greeting / first message" hint="This becomes the first page of every new conversation."><Textarea value={draft.greeting} onChange={(event) => update("greeting", event.target.value)} placeholder="Set the scene, place the character in motion, and leave the user room to answer." className="min-h-52" /></Field>
              {draft.greeting.trim() ? <blockquote className="codex-opening-preview">{draft.greeting}</blockquote> : null}
              {generatedPreview ? <GeneratedPreviewCard preview={generatedPreview} /> : null}
              <Button type="button" variant="outline" onClick={generatePreview} disabled={!canGeneratePreview || generatingPreview}><Sparkles className="h-4 w-4" />{generatingPreview ? "Drafting..." : "Draft missing chapters"}</Button>
            </StudioChapter>
            <StudioChapter id="publishing" number="03" title="Bind the volume" description="Choose how this character enters your library." active={activeChapter === "publishing"} onSelect={() => selectChapter("publishing")}>
              <p className="font-editorial text-xl italic leading-8 text-[var(--text-secondary)]">The guided edition keeps advanced behavior private until you open the complete manuscript.</p>
              <Button type="button" variant="outline" onClick={() => switchFormMode("custom")}><SlidersHorizontal className="h-4 w-4" />Open complete manuscript</Button>
            </StudioChapter>
          </div>
        ) : (
          <div className="codex-chapter-stack">
            <StudioChapter id="identity" number="01" title="Identity" description="The portrait, name, and core promise readers meet first." active={activeChapter === "identity"} onSelect={() => selectChapter("identity")} onAssist={() => assistSection("basics")} assisting={assistingSection === "basics"}>
              <Field label="Portrait"><AvatarUpload value={draft.avatarUrl} name={draft.name} onChange={(value) => update("avatarUrl", value)} onError={setError} large /></Field>
              <Field label="Character name" required><Input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ari the Archivist" required /></Field>
              <Field label="Essence" required><Textarea value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="A soft-spoken fantasy guide with a sharp memory." className="min-h-40" required /></Field>
              <Field label="Index terms"><TagChipInput value={draft.tags} onChange={(tags) => update("tags", tags)} placeholder="Type any tag and press Enter" /></Field>
              <div className="grid gap-6 sm:grid-cols-2"><Field label="Role"><Input value={draft.personaRole} onChange={(event) => update("personaRole", event.target.value)} placeholder="Mentor, rival, companion..." /></Field><Field label="Archetype"><Input value={draft.archetype} onChange={(event) => update("archetype", event.target.value)} placeholder="Archivist, detective, bard..." /></Field></div>
            </StudioChapter>

            <StudioChapter id="voice" number="02" title="Voice & personality" description="The private logic beneath every response." active={activeChapter === "voice"} onSelect={() => selectChapter("voice")} onAssist={() => assistSection("personality")} assisting={assistingSection === "personality"}>
              <Field label="Personality"><Textarea value={draft.personality} onChange={(event) => update("personality", event.target.value)} placeholder="How they think, react, and carry themselves." className="min-h-44" /></Field>
              <Field label="Traits"><Textarea value={draft.personaTraits} onChange={(event) => update("personaTraits", event.target.value)} placeholder="One trait per line." /></Field>
              <Field label="Speaking style"><Textarea value={draft.speakingStyle} onChange={(event) => update("speakingStyle", event.target.value)} placeholder="Cadence, vocabulary, restraint, recurring habits." /></Field>
              <div className="grid gap-6 sm:grid-cols-2"><Field label="Emotional tone"><Input value={draft.emotionalTone} onChange={(event) => update("emotionalTone", event.target.value)} /></Field><Field label="Tone"><Input value={draft.tone} onChange={(event) => update("tone", event.target.value)} /></Field><Field label="Relationship style"><Input value={draft.relationshipStyle} onChange={(event) => update("relationshipStyle", event.target.value)} /></Field><Field label="Message length"><Input value={draft.messageLength} onChange={(event) => update("messageLength", event.target.value)} /></Field></div>
              <div className="grid gap-6 sm:grid-cols-2"><Field label="Initiative"><Input value={draft.initiativeLevel} onChange={(event) => update("initiativeLevel", event.target.value)} /></Field><Field label="Verbosity"><Input value={draft.verbosityLevel} onChange={(event) => update("verbosityLevel", event.target.value)} /></Field></div>
              <Field label="Motivation"><Textarea value={draft.motivation} onChange={(event) => update("motivation", event.target.value)} /></Field>
            </StudioChapter>

            <StudioChapter id="scene" number="03" title="Scene & first message" description="The world state and first beat that begin the story." active={activeChapter === "scene"} onSelect={() => selectChapter("scene")} onAssist={() => assistSection("scenario")} assisting={assistingSection === "scenario"}>
              <Field label="Scenario / world"><Textarea value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} placeholder="Where the scene starts and what must remain true." className="min-h-44" /></Field>
              <Field label="Greeting / first message" hint="Write it as the opening paragraph of a scene, not an instruction."><Textarea value={draft.greeting} onChange={(event) => update("greeting", event.target.value)} placeholder="The first message your character sends." className="min-h-52" /></Field>
              {draft.greeting.trim() ? <blockquote className="codex-opening-preview">{draft.greeting}</blockquote> : null}
            </StudioChapter>

            <StudioChapter id="lore" number="04" title="Lore & memory" description="Canonical facts that surface only when the story calls for them." active={activeChapter === "lore"} onSelect={() => selectChapter("lore")} onAssist={() => assistSection("lorebook")} assisting={assistingSection === "lorebook"}>
              <Field label="Keyword lorebook" hint="Use blocks like: keyword, alias => canonical fact."><Textarea value={draft.lorebookText} onChange={(event) => update("lorebookText", event.target.value)} placeholder={"silver gate, moon gate => The Silver Gate only opens under a full moon.\n\nArchivist oath => Archivists cannot knowingly destroy a true record."} className="min-h-64" /></Field>
            </StudioChapter>

            <StudioChapter id="appearance" number="05" title="Visual language" description="A restrained palette and environmental cue for the conversation." active={activeChapter === "appearance"} onSelect={() => selectChapter("appearance")} onAssist={() => assistSection("visual")} assisting={assistingSection === "visual"}>
              <div className="grid gap-6 sm:grid-cols-3"><Field label="Accent"><Input type="color" value={draft.visualAccentColor} onChange={(event) => update("visualAccentColor", event.target.value)} /></Field><Field label="Secondary"><Input type="color" value={draft.visualGradientFrom} onChange={(event) => update("visualGradientFrom", event.target.value)} /></Field><Field label="Fallback"><Input type="color" value={draft.visualGradientTo} onChange={(event) => update("visualGradientTo", event.target.value)} /></Field></div>
              <Field label="Chat atmosphere"><Input value={draft.visualChatBackground} onChange={(event) => update("visualChatBackground", event.target.value)} placeholder="moonlit archive, neon rain, warm cabin..." /></Field>
              <div className="codex-color-proof" style={{ borderColor: draft.visualAccentColor }}><span style={{ background: draft.visualGradientFrom }} /><p>{draft.visualChatBackground.trim() || "The environmental cue will guide the chat surface."}</p></div>
            </StudioChapter>

            <StudioChapter id="publishing" number="06" title="Behavior & publishing" description="Model direction, boundaries, intensity, and who may discover the character." active={activeChapter === "publishing"} onSelect={() => selectChapter("publishing")} onAssist={() => assistSection("advanced")} assisting={assistingSection === "advanced"}>
              <div className="codex-subleaf"><p className="codex-kicker">Model direction</p><div className="mt-6 grid gap-6 sm:grid-cols-2"><Field label="Provider override"><select value={draft.preferredProvider} onChange={(event) => { const provider = event.target.value; const option = providerOptions.find((item) => item.provider === provider); setDraft((current) => ({ ...current, preferredProvider: provider, preferredModel: provider && !current.preferredModel ? option?.defaultModel ?? "" : current.preferredModel })); }} className="focus-ring glass-input h-12 w-full px-4 text-sm text-[var(--text-primary)]"><option value="">Use global default</option>{providerOptions.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.displayName}</option>)}</select></Field><Field label="Model override"><Input value={draft.preferredModel} onChange={(event) => update("preferredModel", event.target.value)} /></Field><OptionalNumberInput label="Temperature" value={draft.temperature} min={0} max={2} step={0.1} onChange={(value) => update("temperature", value)} /><OptionalNumberInput label="Top P" value={draft.topP} min={0} max={1} step={0.05} onChange={(value) => update("topP", value)} /><OptionalNumberInput label="Frequency penalty" value={draft.frequencyPenalty} min={-2} max={2} step={0.1} onChange={(value) => update("frequencyPenalty", value)} /><OptionalNumberInput label="Presence penalty" value={draft.presencePenalty} min={-2} max={2} step={0.1} onChange={(value) => update("presencePenalty", value)} /><OptionalNumberInput label="Max tokens" value={draft.maxTokens} min={1} max={32768} step={1} onChange={(value) => update("maxTokens", value)} /></div><Field label="System prompt override" hint="Creator instructions below platform safety and above the persona."><Textarea value={draft.systemPromptOverride} onChange={(event) => update("systemPromptOverride", event.target.value)} maxLength={8000} className="min-h-36" /></Field></div>
              <Field label="Boundaries"><Textarea value={draft.boundaries} onChange={(event) => update("boundaries", event.target.value)} /></Field>
              <Field label="Behavioral rules"><Textarea value={draft.behavioralRules} onChange={(event) => update("behavioralRules", event.target.value)} /></Field>
              <Field label="Forbidden behaviors"><Textarea value={draft.forbiddenBehaviors} onChange={(event) => update("forbiddenBehaviors", event.target.value)} /></Field>
              <div className="grid gap-6 sm:grid-cols-2"><Slider label="Humor" value={draft.humor} onChange={(value) => update("humor", value)} /><Slider label="Romance" value={draft.romanceLevel} onChange={(value) => update("romanceLevel", value)} /><Slider label="Seriousness" value={draft.seriousness} onChange={(value) => update("seriousness", value)} /><Slider label="Initiative" value={draft.initiative} onChange={(value) => update("initiative", value)} /><Slider label="Roleplay intensity" value={draft.roleplayIntensity} onChange={(value) => update("roleplayIntensity", value)} /></div>
              <div className="codex-visibility-index"><VisibilityButton icon={Lock} label="Private" selected={draft.visibility === "PRIVATE"} onClick={() => update("visibility", "PRIVATE")} /><VisibilityButton icon={Globe} label="Unlisted" selected={draft.visibility === "UNLISTED"} onClick={() => update("visibility", "UNLISTED")} /><VisibilityButton icon={Globe} label="Public" selected={draft.visibility === "PUBLIC"} onClick={() => update("visibility", "PUBLIC")} /></div>
              <label className="codex-check-row"><input type="checkbox" checked={draft.isNSFW} onChange={(event) => update("isNSFW", event.target.checked)} />Mark as age-gated / NSFW</label>
              <div className="codex-subleaf"><p className="codex-kicker">Character Card V2</p><p className="mt-2 text-sm text-[var(--text-muted)]">Import or export this dossier as interoperable JSON.</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={exportCharacterCard}><Download className="h-4 w-4" />Export Card V2</Button><Button type="button" variant="outline" onClick={importCharacterCard}><FileJson className="h-4 w-4" />Import JSON</Button></div><Textarea value={draft.characterCardJson} onChange={(event) => update("characterCardJson", event.target.value)} className="mt-4 min-h-36 font-mono text-xs" /></div>
            </StudioChapter>
          </div>
        )}

        {error ? <p className="codex-error-note">{error}</p> : null}

        <footer className="codex-studio-actions">
          <div className="flex min-w-0 items-center gap-2">
            {!isPromptMode && currentChapterIndex > 0 ? <Button type="button" variant="ghost" onClick={() => selectChapter(visibleChapters[currentChapterIndex - 1].id)}>Previous</Button> : null}
            {!isPromptMode && currentChapterIndex < visibleChapters.length - 1 ? <Button type="button" variant="outline" onClick={() => selectChapter(visibleChapters[currentChapterIndex + 1].id)}>Next chapter</Button> : null}
            {isPromptMode ? <><Button type="button" variant="outline" onClick={() => promptOptions && void generateFromPrompt(promptOptions)} disabled={generatingPreview || prompt.trim().length < 12 || !promptOptions}><Sparkles className="h-4 w-4" />Regenerate</Button><Button type="button" variant="ghost" onClick={() => switchFormMode("custom")} disabled={!promptGenerated}>Review full dossier</Button></> : null}
          </div>
          <Button type="submit" size="lg" disabled={saving || !canSubmit}><Save className="h-4 w-4" />{saving ? "Binding..." : mode === "edit" ? "Save revision" : "Create character"}</Button>
        </footer>
      </form>
    </div>
  );
}

function StudioChapter({
  id,
  number,
  title,
  description,
  active,
  onSelect,
  onAssist,
  assisting = false,
  children
}: {
  id: StudioChapterId;
  number: string;
  title: string;
  description: string;
  active: boolean;
  onSelect: () => void;
  onAssist?: () => void;
  assisting?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={`studio-${id}`} className={cn("codex-manuscript-chapter scroll-mt-6", active && "is-active")}>
      <header className="codex-chapter-heading">
        <button type="button" onClick={onSelect} aria-expanded={active} aria-controls={`studio-${id}-body`}>
          {number}
        </button>
        <div>
          <p className="codex-kicker">Chapter {number}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {onAssist ? (
          <button type="button" className="codex-margin-assist" onClick={onAssist} disabled={assisting}>
            <Sparkles className="h-4 w-4" />
            {assisting ? "Writing..." : "Assist this chapter"}
          </button>
        ) : null}
      </header>
      <div id={`studio-${id}-body`} className="codex-chapter-body">{children}</div>
    </section>
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
    tone: draft.tone,
    lorebookText: draft.lorebookText,
    visualChatBackground: draft.visualChatBackground
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
    tone: suggestions.tone?.trim() || draft.tone,
    lorebookText: suggestions.lorebookText?.trim() || draft.lorebookText,
    visualChatBackground: suggestions.visualChatBackground?.trim() || draft.visualChatBackground
  };
}

function parseCreatorNotes(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return {} as {
      persona?: Record<string, unknown>;
      lorebook?: Record<string, unknown>;
      visualIdentity?: Record<string, unknown>;
    };
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as {
      persona?: Record<string, unknown>;
      lorebook?: Record<string, unknown>;
      visualIdentity?: Record<string, unknown>;
    } : {};
  } catch {
    return {};
  }
}

function textFromCard(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
              "grid place-items-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--accent-purple)]",
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
      data-active={active}
      className={cn(
        "focus-ring flex h-12 items-center justify-center gap-2 border-b-2 text-xs font-semibold uppercase tracking-[.15em] transition-colors duration-150 active:scale-95",
        active
          ? "border-[var(--accent-mint)] text-[var(--accent-mint)]"
          : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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

function OptionalNumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        placeholder="Use platform default"
      />
    </Field>
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
        selected ? "bg-primary text-primary-foreground" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
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
