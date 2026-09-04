"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  ImagePlus,
  Download,
  FileJson,
  Lock,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  Zap
} from "lucide-react";
import { CharacterPreviewPanel } from "@/components/characters/character-preview-panel";
import {
  CharacterFileImportPanel,
  type CharacterFileImportResult
} from "@/components/characters/character-file-import-panel";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { BotGenerator } from "@/components/character/BotGenerator";
import { TagChipInput } from "@/components/characters/tag-chip-input";
import { FormattedTextarea } from "@/components/rich-text/formatted-textarea";
import { Button } from "@/components/ui/button";
import { ImageFilePicker } from "@/components/ui/image-file-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applyGeneratedPreview,
  applyCharacterCardJsonToDraft,
  applyPromptGenerationToDraft,
  buildCharacterCreatePayload,
  creationModeForEditor,
  creationModeForNewCharacter,
  firstValidationIssue,
  normalizeInitialCharacterValue,
  parseLorebookText,
  promptPreviewFromGeneration,
  validateCharacterCreatePayload
} from "@/lib/character-form-payload";
import {
  VIBE_PRESETS,
  type AdditionalCharacterDraft,
  type CharacterCreationMode,
  type CharacterFormInitialValue,
  type CharacterFormMode,
  type CharacterFormValue,
  type CustomSectionId,
  type GeneratedCharacterPreview
} from "@/lib/character-form-types";
import { RESPONSE_LENGTH_OPTIONS } from "@/lib/response-length";
import { cn } from "@/lib/utils";
import { FIRST_CLASS_PROVIDER_PRESETS } from "@/lib/provider-presets";
import type { GeneratedCharacterConcept } from "@/lib/generation/character-generator-types";
import { matchLorebookEntries } from "@/lib/lorebook";
import { MAX_CHARACTER_SYSTEM_PROMPT_CHARACTERS } from "@/lib/prompt-limits";
import { estimatePromptTokens } from "@/lib/prompt-budget";

type CharacterFormProps = {
  mode: "create" | "edit";
  initialValue?: CharacterFormInitialValue;
  unlimitedCharacterFields?: boolean;
};

type ProviderOption = {
  provider: string;
  displayName: string;
  defaultModel: string;
};

type StudioChapterId = "identity" | "voice" | "scene" | "lore" | "appearance" | "publishing";
type BehaviorSliderField = "humor" | "romanceLevel" | "seriousness" | "initiative" | "roleplayIntensity";
type IdentityFieldId = "character-name" | "character-description";

const behaviorSliderFields: Array<{ field: BehaviorSliderField; label: string }> = [
  { field: "humor", label: "Humor" },
  { field: "romanceLevel", label: "Romance" },
  { field: "seriousness", label: "Seriousness" },
  { field: "initiative", label: "Initiative" },
  { field: "roleplayIntensity", label: "Roleplay intensity" }
];

const studioChapters: Array<{ id: StudioChapterId; number: string; label: string }> = [
  { id: "identity", number: "01", label: "Identity" },
  { id: "voice", number: "02", label: "Voice & personality" },
  { id: "scene", number: "03", label: "Scene & first message" },
  { id: "lore", number: "04", label: "Lore & memory" },
  { id: "appearance", number: "05", label: "Visual language" },
  { id: "publishing", number: "06", label: "Behavior & publishing" }
];

const guidedChapters: Array<{ id: StudioChapterId; number: string; label: string }> = [
  { id: "identity", number: "01", label: "Identity" },
  { id: "voice", number: "02", label: "Personality & scenario" },
  { id: "scene", number: "03", label: "First scene" }
];

export function CharacterForm({ mode, initialValue, unlimitedCharacterFields = false }: CharacterFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<CharacterFormValue>(() => normalizeInitialCharacterValue(initialValue));
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<{ fieldId: IdentityFieldId; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [assistingSection, setAssistingSection] = useState<CustomSectionId | null>(null);
  const [formMode, setFormMode] = useState<CharacterFormMode>(() =>
    mode === "edit" ? creationModeForEditor(initialValue?.creationMode) : "simple"
  );
  const [activeChapter, setActiveChapter] = useState<StudioChapterId>("identity");
  const [generatedPreview, setGeneratedPreview] = useState<GeneratedCharacterPreview | null>(null);
  const [savedProviderOptions, setSavedProviderOptions] = useState<ProviderOption[]>([]);
  const [importTargetMode, setImportTargetMode] = useState<CharacterCreationMode>(() =>
    formMode === "custom" ? "custom" : "simple"
  );
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const [fileImportResult, setFileImportResult] = useState<CharacterFileImportResult | null>(null);
  const [lorebookPreviewText, setLorebookPreviewText] = useState("");

  useEffect(() => {
    if (mode !== "edit") return;

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
  }, [mode]);

  useEffect(() => {
    if (!error) return;

    requestAnimationFrame(() => {
      const errorMessage = document.getElementById("character-form-error");
      errorMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      errorMessage?.focus({ preventScroll: true });
    });
  }, [error]);

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

  const isSimpleMode = formMode === "simple";
  const isPromptMode = mode === "create" && formMode === "prompt";
  const previewDraft = useMemo(
    () => (generatedPreview ? mergePreviewIntoDraft(draft, generatedPreview) : draft),
    [draft, generatedPreview]
  );
  const parsedLorebook = useMemo(
    () => parseLorebookText(draft.lorebookText, unlimitedCharacterFields),
    [draft.lorebookText, unlimitedCharacterFields]
  );
  const lorebookMatches = useMemo(
    () => matchLorebookEntries(parsedLorebook, [lorebookPreviewText]),
    [lorebookPreviewText, parsedLorebook]
  );

  const canSubmit = !isPromptMode && draft.name.trim().length >= 2 && draft.description.trim().length >= 10;
  const canGeneratePreview = !isPromptMode && draft.name.trim().length >= 2 && draft.description.trim().length >= 10;

  function update<K extends keyof CharacterFormValue>(field: K, value: CharacterFormValue[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "avatarUrl") {
      setAvatarError(null);
    }
    if (field === "name" || field === "description") {
      setIdentityError(null);
    }
    if (formMode === "simple" && field !== "greeting" && field !== "avatarUrl" && field !== "tags") {
      setGeneratedPreview(null);
    }
  }

  function addAdditionalPersonality() {
    setDraft((current) => {
      if (current.additionalCharacters.length >= 7) return current;

      return {
        ...current,
        additionalCharacters: [
          ...current.additionalCharacters,
          {
            id: `cast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            name: "",
            personality: ""
          }
        ]
      };
    });
  }

  function updateAdditionalPersonality(id: string, field: keyof Omit<AdditionalCharacterDraft, "id">, value: string) {
    setDraft((current) => ({
      ...current,
      additionalCharacters: current.additionalCharacters.map((character) =>
        character.id === id ? { ...character, [field]: value } : character
      )
    }));
  }

  function removeAdditionalPersonality(id: string) {
    setDraft((current) => ({
      ...current,
      additionalCharacters: current.additionalCharacters.filter((character) => character.id !== id)
    }));
  }

  function revealAvatarError(message: string) {
    setError(null);
    setAvatarError(message);
    setActiveChapter("identity");
    requestAnimationFrame(() => {
      const avatarField = document.getElementById("character-avatar");
      avatarField?.scrollIntoView({ behavior: "smooth", block: "center" });
      avatarField?.focus({ preventScroll: true });
    });
  }

  function revealIdentityError(message: string, fieldId: IdentityFieldId) {
    setError(null);
    setIdentityError({ fieldId, message });
    setActiveChapter("identity");
    requestAnimationFrame(() => {
      const field = document.getElementById(fieldId);
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus({ preventScroll: true });
    });
  }

  function switchFormMode(nextMode: CharacterFormMode) {
    if (nextMode === "custom" && generatedPreview) {
      setDraft((current) => mergePreviewIntoDraft(current, generatedPreview));
    }
    if (nextMode === "simple" && !guidedChapters.some((chapter) => chapter.id === activeChapter)) {
      setActiveChapter("identity");
    }
    if (nextMode === "simple" || nextMode === "custom") {
      setImportTargetMode(nextMode);
    }
    setFormMode(nextMode);
    setError(null);
    setAvatarError(null);
    setIdentityError(null);
  }

  function selectImportTarget(nextMode: CharacterCreationMode) {
    setImportTargetMode(nextMode);
    switchFormMode(nextMode);
  }

  function selectSourceFile(file: File | null) {
    setFileImportResult(null);
    if (!file) {
      setSourceFile(null);
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["txt", "md", "json", "yaml", "yml", "docx", "pdf"].includes(extension)) {
      setSourceFile(null);
      setError("Use a TXT, Markdown, JSON, YAML, DOCX, or PDF file.");
      return;
    }
    if (file.size > 4_000_000) {
      setSourceFile(null);
      setError("The selected file is larger than 4 MB.");
      return;
    }

    setSourceFile(file);
    setError(null);
  }

  async function importSourceFile() {
    if (!sourceFile) return;

    setImportingFile(true);
    setFileImportResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", sourceFile);
      formData.set("targetMode", importTargetMode);
      const response = await fetch("/api/characters/import", {
        method: "POST",
        body: formData
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not create a character draft from this file.");
        return;
      }

      if (body?.kind === "character-card" && typeof body.characterCardJson === "string") {
        setDraft((current) => applyCharacterCardJsonToDraft(current, body.characterCardJson));
        setGeneratedPreview(null);
      } else if (body?.kind === "generated" && body.generated) {
        setDraft((current) => applyPromptGenerationToDraft(current, body.generated));
        setGeneratedPreview(promptPreviewFromGeneration(body.generated));
      } else {
        setError("The file was read, but no character draft was returned.");
        return;
      }

      setFormMode(importTargetMode);
      setActiveChapter("identity");
      setFileImportResult({
        fileName: typeof body?.file?.name === "string" ? body.file.name : sourceFile.name,
        kind: body.kind,
        warnings: Array.isArray(body.warnings) ? body.warnings.filter((warning: unknown) => typeof warning === "string") : []
      });
    } catch {
      setError("Could not create a character draft from this file.");
    } finally {
      setImportingFile(false);
    }
  }

  function applyGeneratedCharacter(generated: GeneratedCharacterConcept) {
    setDraft((current) => ({
      ...current,
      name: generated.name,
      avatarUrl: generated.avatarUrl ?? current.avatarUrl,
      description: generated.description,
      personality: generated.personality,
      background: generated.background,
      speakingStyle: generated.speechPattern,
      scenario: generated.scenario,
      greeting: generated.firstMessage,
      tags: generated.tags,
      visualAvatarPrompt: generated.avatarPrompt
    }));
    setGeneratedPreview({
      name: generated.name,
      description: generated.description,
      personality: generated.personality,
      scenario: generated.scenario,
      greeting: generated.firstMessage,
      tags: generated.tags
    });
    setImportTargetMode("custom");
    setFormMode("custom");
    setActiveChapter("identity");
    setError(null);
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
      creationMode: mode === "edit" ? creationModeForEditor(initialValue?.creationMode) : creationModeForNewCharacter(formMode),
      unlimitedCharacterFields
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
      setDraft((current) => applyCharacterCardJsonToDraft(current, draft.characterCardJson));
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

      const preview = {
        personality: generated.personality,
        scenario: generated.scenario,
        greeting: draft.greeting.trim() || generated.greeting,
        tags: Array.isArray(generated.tags) ? generated.tags : draft.tags,
        persona: generated.persona ?? null,
        communicationStyle: generated.communicationStyle ?? null
      };

      setGeneratedPreview(preview);
      setDraft((current) => applyGeneratedPreview(current, preview));
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
    if (saving) return;

    setError(null);
    setIdentityError(null);

    if (isPromptMode) {
      setError("Generate a draft and apply it before creating the character.");
      return;
    }

    if (draft.name.trim().length < 2) {
      revealIdentityError("Enter a character name using at least 2 characters.", "character-name");
      return;
    }

    if (draft.description.trim().length < 10) {
      revealIdentityError("Describe the character's core idea using at least 10 characters.", "character-description");
      return;
    }

    const preview = generatedPreview;

    if (!isSimpleMode && draft.visibility === "PUBLIC" && !draft.avatarUrl.trim()) {
      revealAvatarError("Add an avatar before publishing publicly, or save the character as private.");
      return;
    }

    const payload = buildCharacterCreatePayload({
      draft,
      generated: preview,
      isSimpleMode: isSimpleMode || isPromptMode,
      creationMode: mode === "edit" ? creationModeForEditor(initialValue?.creationMode) : creationModeForNewCharacter(formMode),
      unlimitedCharacterFields
    });

    const validation = validateCharacterCreatePayload(payload, unlimitedCharacterFields);
    if (!validation.success) {
      setError(firstValidationIssue(validation) ?? "Invalid request body.");
      return;
    }

    const url = mode === "edit" && draft.id ? `/api/characters/${draft.id}` : "/api/characters";
    setSaving(true);
    try {
      const response = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const issueMessage = firstIssueMessage(body?.issues);
        setError(issueMessage ? `${body?.error ?? "Could not save character."} ${issueMessage}` : body?.error ?? "Could not save character.");
        return;
      }

      if (typeof body?.character?.id !== "string") {
        setError("The character was saved, but the server returned an invalid response. Refresh your library before trying again.");
        return;
      }

      window.dispatchEvent(new CustomEvent("nythera:characters-updated", { detail: { characterId: body.character.id } }));
      router.push(`/character/${body.character.id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const visibleChapters = (isSimpleMode ? guidedChapters : studioChapters)
    .filter((chapter) => mode === "edit" || chapter.id !== "publishing");
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

      <form noValidate onSubmit={onSubmit} className="codex-manuscript chat-scroll min-w-0 overflow-y-auto">
        <header className="codex-studio-header">
          <div>
            <p className="codex-kicker">{mode === "edit" ? "Character archive / revision" : "New volume / character studio"}</p>
            <h1 className="font-editorial mt-3 text-[clamp(2.8rem,6vw,5.25rem)] font-medium leading-[.84] tracking-[-.04em] text-[var(--codex-ivory)]">
              {mode === "edit" ? "Revise the dossier" : "Inscribe a living voice"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Move through the manuscript chapter by chapter. The dossier beside it updates as the character takes shape.
            </p>
            {unlimitedCharacterFields ? (
              <p className="mt-4 inline-flex border border-[var(--codex-mint)]/45 bg-[var(--codex-mint)]/[.06] px-3 py-2 font-mono text-[10px] uppercase tracking-[.14em] text-[var(--codex-mint)]">
                Owner access · character text fields have no length limit
              </p>
            ) : null}
          </div>

          {mode === "create" ? (
            <div className="codex-mode-index" aria-label="Creation method">
              <ModeButton label="Inscribe" icon={Zap} active={isPromptMode} onClick={() => switchFormMode("prompt")} />
              <ModeButton label="Guided" icon={Wand2} active={isSimpleMode} onClick={() => switchFormMode("simple")} />
              <ModeButton label="Complete" icon={SlidersHorizontal} active={formMode === "custom"} onClick={() => switchFormMode("custom")} />
            </div>
          ) : null}
        </header>

        {mode === "create" ? (
          <CharacterFileImportPanel
            targetMode={importTargetMode}
            file={sourceFile}
            importing={importingFile}
            result={fileImportResult}
            onTargetModeChange={selectImportTarget}
            onFileChange={selectSourceFile}
            onImport={() => void importSourceFile()}
          />
        ) : null}

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
            <BotGenerator onApply={applyGeneratedCharacter} />
          </section>
        ) : isSimpleMode ? (
          <div className="codex-chapter-stack">
            <StudioChapter id="identity" number="01" title="Identity" description="Name the character and define the promise at the center of every conversation." active={activeChapter === "identity"} onSelect={() => selectChapter("identity")} onAssist={() => assistSection("basics")} assisting={assistingSection === "basics"}>
              <Field label="Portrait" error={avatarError}><AvatarUpload id="character-avatar" value={draft.avatarUrl} name={draft.name} onChange={(value) => update("avatarUrl", value)} onError={revealAvatarError} large /></Field>
              <Field label="Character name" error={identityError?.fieldId === "character-name" ? identityError.message : null} required><Input id="character-name" value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ari the Archivist" minLength={2} required /></Field>
              <Field label="Core idea" hint="Formatting is rendered everywhere this subtitle appears." error={identityError?.fieldId === "character-description" ? identityError.message : null} required><FormattedTextarea id="character-description" value={draft.description} onChange={(value) => update("description", value)} placeholder="Who are they, what tension follows them, and why should someone stay?" className="min-h-40" minLength={10} required /></Field>
              <Field label="Index terms"><TagChipInput value={draft.tags} onChange={(tags) => update("tags", tags)} presets={VIBE_PRESETS} /></Field>
            </StudioChapter>
            <StudioChapter id="voice" number="02" title="Personality & scenario" description="Add the character's inner logic and the world around them, or let Nythera draft only what is missing." active={activeChapter === "voice"} onSelect={() => selectChapter("voice")}>
              <Field label="Personality" hint="Optional. Describe how they think, react, and carry themselves."><Textarea value={draft.personality} onChange={(event) => update("personality", event.target.value)} placeholder="Calm under pressure, fiercely observant, and reluctant to trust easy answers." className="min-h-44" /></Field>
              <AdditionalPersonalitiesEditor characters={draft.additionalCharacters} onAdd={addAdditionalPersonality} onChange={updateAdditionalPersonality} onRemove={removeAdditionalPersonality} />
              <Field label="Background"><Textarea value={draft.background} onChange={(event) => update("background", event.target.value)} placeholder="What shaped them, and what do they want now?" className="min-h-44" /></Field>
              <Field label="Scenario / world" hint="Optional. Establish where the story starts and what must remain true."><Textarea value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} placeholder="The archive is sealed for the night when a forbidden volume opens by itself." className="min-h-44" /></Field>
              {generatedPreview ? <GeneratedPreviewCard preview={generatedPreview} /> : null}
              <Button type="button" variant="outline" onClick={generatePreview} disabled={!canGeneratePreview || generatingPreview}><Sparkles className="h-4 w-4" />{generatingPreview ? "Drafting..." : "Draft empty fields"}</Button>
            </StudioChapter>
            <StudioChapter id="scene" number="03" title="First scene" description="Write the threshold where the relationship begins." active={activeChapter === "scene"} onSelect={() => selectChapter("scene")} onAssist={() => assistSection("greeting")} assisting={assistingSection === "greeting"}>
              <Field label="Greeting / first message" hint="This becomes the first page of every new conversation."><FormattedTextarea value={draft.greeting} onChange={(value) => update("greeting", value)} placeholder="Set the scene, place the character in motion, and leave the user room to answer." className="min-h-52" /></Field>
            </StudioChapter>
          </div>
        ) : (
          <div className="codex-chapter-stack">
            <StudioChapter id="identity" number="01" title="Identity" description="The portrait, name, and core promise readers meet first." active={activeChapter === "identity"} onSelect={() => selectChapter("identity")} onAssist={() => assistSection("basics")} assisting={assistingSection === "basics"}>
              <Field label="Portrait" error={avatarError}><AvatarUpload id="character-avatar" value={draft.avatarUrl} name={draft.name} onChange={(value) => update("avatarUrl", value)} onError={revealAvatarError} large /></Field>
              <Field label="Character name" error={identityError?.fieldId === "character-name" ? identityError.message : null} required><Input id="character-name" value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ari the Archivist" minLength={2} required /></Field>
              <Field label="Essence" hint="Formatting is rendered everywhere this subtitle appears." error={identityError?.fieldId === "character-description" ? identityError.message : null} required><FormattedTextarea id="character-description" value={draft.description} onChange={(value) => update("description", value)} placeholder="A soft-spoken fantasy guide with a sharp memory." className="min-h-40" minLength={10} required /></Field>
              <Field label="Index terms"><TagChipInput value={draft.tags} onChange={(tags) => update("tags", tags)} placeholder="Type any tag and press Enter" /></Field>
              <div className="grid gap-6 sm:grid-cols-2"><Field label="Role"><Input value={draft.personaRole} onChange={(event) => update("personaRole", event.target.value)} placeholder="Mentor, rival, companion..." /></Field><Field label="Archetype"><Input value={draft.archetype} onChange={(event) => update("archetype", event.target.value)} placeholder="Archivist, detective, bard..." /></Field></div>
            </StudioChapter>

            <StudioChapter id="voice" number="02" title="Voice & personality" description="The private logic beneath every response." active={activeChapter === "voice"} onSelect={() => selectChapter("voice")} onAssist={() => assistSection("personality")} assisting={assistingSection === "personality"}>
              <Field label="Personality"><Textarea value={draft.personality} onChange={(event) => update("personality", event.target.value)} placeholder="How they think, react, and carry themselves." className="min-h-44" /></Field>
              <AdditionalPersonalitiesEditor characters={draft.additionalCharacters} onAdd={addAdditionalPersonality} onChange={updateAdditionalPersonality} onRemove={removeAdditionalPersonality} />
              <Field label="Background"><Textarea value={draft.background} onChange={(event) => update("background", event.target.value)} placeholder="The history and motivations that shaped them." className="min-h-44" /></Field>
              <Field label="Traits"><Textarea value={draft.personaTraits} onChange={(event) => update("personaTraits", event.target.value)} placeholder="One trait per line." /></Field>
              <Field label="Speaking style"><Textarea value={draft.speakingStyle} onChange={(event) => update("speakingStyle", event.target.value)} placeholder="Cadence, vocabulary, restraint, recurring habits." /></Field>
              <div className="grid gap-6 sm:grid-cols-2"><Field label="Emotional tone"><Input value={draft.emotionalTone} onChange={(event) => update("emotionalTone", event.target.value)} /></Field><Field label="Tone"><Input value={draft.tone} onChange={(event) => update("tone", event.target.value)} /></Field><Field label="Relationship style"><Input value={draft.relationshipStyle} onChange={(event) => update("relationshipStyle", event.target.value)} /></Field></div>
              <div className="grid gap-6 sm:grid-cols-2"><Field label="Initiative"><Input value={draft.initiativeLevel} onChange={(event) => update("initiativeLevel", event.target.value)} /></Field><Field label="Verbosity"><Input value={draft.verbosityLevel} onChange={(event) => update("verbosityLevel", event.target.value)} /></Field></div>
              <Field label="Motivation"><Textarea value={draft.motivation} onChange={(event) => update("motivation", event.target.value)} /></Field>
            </StudioChapter>

            <StudioChapter id="scene" number="03" title="Scene & first message" description="The world state and first beat that begin the story." active={activeChapter === "scene"} onSelect={() => selectChapter("scene")} onAssist={() => assistSection("scenario")} assisting={assistingSection === "scenario"}>
              <Field label="Scenario / world"><Textarea value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} placeholder="Where the scene starts and what must remain true." className="min-h-44" /></Field>
              <Field label="Greeting / first message" hint="Write it as the opening paragraph of a scene, not an instruction."><FormattedTextarea value={draft.greeting} onChange={(value) => update("greeting", value)} placeholder="The first message your character sends." className="min-h-52" /></Field>
            </StudioChapter>

            <StudioChapter id="lore" number="04" title="Lore & memory" description="Canonical facts that surface only when the story calls for them." active={activeChapter === "lore"} onSelect={() => selectChapter("lore")} onAssist={() => assistSection("lorebook")} assisting={assistingSection === "lorebook"}>
              <div className="codex-subleaf space-y-3">
                <p className="codex-kicker">How it works</p>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">Write comma-separated trigger words before <code>=&gt;</code>, then the canonical fact. When a trigger appears in the current turn or recent chat history, Nythera adds that fact to the character&apos;s private context.</p>
                <p className="text-xs leading-5 text-[var(--text-muted)]">Use a blank line between entries. Matching ignores capitalization and checks text inside longer phrases.</p>
              </div>
              <Field label="Keyword lorebook" hint={`${parsedLorebook.entries.length} valid ${parsedLorebook.entries.length === 1 ? "entry" : "entries"}.`}><Textarea value={draft.lorebookText} onChange={(event) => update("lorebookText", event.target.value)} placeholder={"silver gate, moon gate => The Silver Gate only opens under a full moon.\n\nArchivist oath => Archivists cannot knowingly destroy a true record."} className="min-h-64" /></Field>
              <div className="codex-subleaf space-y-3">
                <div><p className="codex-kicker">Test triggers</p><p className="mt-2 text-sm text-[var(--text-muted)]">Type a sample player message to see exactly which facts would enter the next reply.</p></div>
                <Input value={lorebookPreviewText} onChange={(event) => setLorebookPreviewText(event.target.value)} placeholder="We finally reached the silver gate." />
                {lorebookPreviewText.trim() ? (
                  lorebookMatches.length ? (
                    <div className="grid gap-2" role="status">
                      {lorebookMatches.map((entry, index) => (
                        <div key={entry.id ?? `${entry.matchedKeywords.join("-")}-${index}`} className="rounded-sm border border-[var(--codex-mint)]/35 bg-[var(--codex-mint)]/[.05] p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--codex-mint)]">Triggered by {entry.matchedKeywords.join(", ")}</p>
                          <p className="mt-1.5 text-sm leading-6 text-[var(--text-primary)]">{entry.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-[var(--text-muted)]" role="status">No entries match this sample yet.</p>
                ) : <p className="text-sm text-[var(--text-muted)]">No sample entered.</p>}
              </div>
            </StudioChapter>

            <StudioChapter id="appearance" number="05" title="Visual language" description="A restrained palette and environmental cue for the conversation." active={activeChapter === "appearance"} onSelect={() => selectChapter("appearance")} onAssist={() => assistSection("visual")} assisting={assistingSection === "visual"}>
              <div className="grid gap-6 sm:grid-cols-3"><Field label="Accent"><Input type="color" value={draft.visualAccentColor} onChange={(event) => update("visualAccentColor", event.target.value)} /></Field><Field label="Secondary"><Input type="color" value={draft.visualGradientFrom} onChange={(event) => update("visualGradientFrom", event.target.value)} /></Field><Field label="Fallback"><Input type="color" value={draft.visualGradientTo} onChange={(event) => update("visualGradientTo", event.target.value)} /></Field></div>
              <Field label="Chat atmosphere"><Input value={draft.visualChatBackground} onChange={(event) => update("visualChatBackground", event.target.value)} placeholder="moonlit archive, neon rain, warm cabin..." /></Field>
              <Field label="Avatar prompt"><Textarea value={draft.visualAvatarPrompt} onChange={(event) => update("visualAvatarPrompt", event.target.value)} placeholder="Portrait direction for an image generator." /></Field>
              <div className="codex-color-proof" style={{ borderColor: draft.visualAccentColor }}><span style={{ background: draft.visualGradientFrom }} /><p>{draft.visualChatBackground.trim() || "The environmental cue will guide the chat surface."}</p></div>
            </StudioChapter>

            {mode === "edit" ? <StudioChapter id="publishing" number="06" title="Behavior & publishing" description="Model direction, boundaries, intensity, and who may discover the character." active={activeChapter === "publishing"} onSelect={() => selectChapter("publishing")} onAssist={() => assistSection("advanced")} assisting={assistingSection === "advanced"}>
              <div className="codex-subleaf"><p className="codex-kicker">Model direction</p><div className="mt-6 grid gap-6 sm:grid-cols-2"><Field label="Default experience"><select value={draft.defaultChatMode} onChange={(event) => update("defaultChatMode", event.target.value === "fantasy" ? "fantasy" : "realism")} className="focus-ring glass-input h-12 w-full px-4 text-sm text-[var(--text-primary)]"><option value="realism">Realism — natural and grounded</option><option value="fantasy">Fantasy — vivid and immersive</option></select></Field><Field label="Provider override"><select value={draft.preferredProvider} onChange={(event) => { const provider = event.target.value; const option = providerOptions.find((item) => item.provider === provider); setDraft((current) => ({ ...current, preferredProvider: provider, preferredModel: provider && !current.preferredModel ? option?.defaultModel ?? "" : current.preferredModel })); }} className="focus-ring glass-input h-12 w-full px-4 text-sm text-[var(--text-primary)]"><option value="">Use global default</option>{providerOptions.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.displayName}</option>)}</select></Field><Field label="Model override"><Input value={draft.preferredModel} onChange={(event) => update("preferredModel", event.target.value)} /></Field><OptionalNumberInput label="Temperature" value={draft.temperature} min={0} max={2} step={0.1} onChange={(value) => update("temperature", value)} /><OptionalNumberInput label="Top P" value={draft.topP} min={0} max={1} step={0.05} onChange={(value) => update("topP", value)} /><OptionalNumberInput label="Frequency penalty" value={draft.frequencyPenalty} min={-2} max={2} step={0.1} onChange={(value) => update("frequencyPenalty", value)} /><OptionalNumberInput label="Presence penalty" value={draft.presencePenalty} min={-2} max={2} step={0.1} onChange={(value) => update("presencePenalty", value)} /><OptionalNumberInput label="Max tokens" value={draft.maxTokens} min={1} max={4096} step={1} onChange={(value) => update("maxTokens", value)} /></div><Field label="System prompt override" hint={`Creator instructions below platform safety and above the persona · ${draft.systemPromptOverride.length.toLocaleString()}${unlimitedCharacterFields ? " characters · no account limit" : ` / ${MAX_CHARACTER_SYSTEM_PROMPT_CHARACTERS.toLocaleString()} characters`} · ~${estimatePromptTokens(draft.systemPromptOverride).toLocaleString()} tokens`}><Textarea value={draft.systemPromptOverride} onChange={(event) => update("systemPromptOverride", event.target.value)} maxLength={unlimitedCharacterFields ? undefined : MAX_CHARACTER_SYSTEM_PROMPT_CHARACTERS} className="min-h-36" /></Field></div>
              <Field label="Boundaries"><Textarea value={draft.boundaries} onChange={(event) => update("boundaries", event.target.value)} /></Field>
              <Field label="Behavioral rules"><Textarea value={draft.behavioralRules} onChange={(event) => update("behavioralRules", event.target.value)} /></Field>
              <Field label="Forbidden behaviors"><Textarea value={draft.forbiddenBehaviors} onChange={(event) => update("forbiddenBehaviors", event.target.value)} /></Field>
              <BehaviorControls
                draft={draft}
                onSliderChange={update}
                onMessageLengthChange={(value) => update("messageLength", value)}
              />
              <div className="codex-visibility-index"><VisibilityButton icon={Lock} label="Private" selected={draft.visibility === "PRIVATE"} onClick={() => update("visibility", "PRIVATE")} /><VisibilityButton icon={Globe} label="Unlisted" selected={draft.visibility === "UNLISTED"} onClick={() => update("visibility", "UNLISTED")} /><VisibilityButton icon={Globe} label="Public" selected={draft.visibility === "PUBLIC"} onClick={() => update("visibility", "PUBLIC")} /></div>
              <label className="codex-check-row"><input type="checkbox" checked={draft.isNSFW} onChange={(event) => update("isNSFW", event.target.checked)} />Mark as age-gated / NSFW</label>
              <div className="codex-subleaf"><p className="codex-kicker">Character Card V2</p><p className="mt-2 text-sm text-[var(--text-muted)]">Import or export this dossier as interoperable JSON.</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={exportCharacterCard}><Download className="h-4 w-4" />Export Card V2</Button><Button type="button" variant="outline" onClick={importCharacterCard}><FileJson className="h-4 w-4" />Import JSON</Button></div><Textarea value={draft.characterCardJson} onChange={(event) => update("characterCardJson", event.target.value)} className="mt-4 min-h-36 font-mono text-xs" /></div>
            </StudioChapter> : null}
          </div>
        )}

        <footer className="codex-studio-actions">
          {error ? (
            <p id="character-form-error" className="codex-error-note codex-studio-action-error" role="alert" tabIndex={-1}>
              {error}
            </p>
          ) : null}
          <div className="codex-studio-secondary-actions flex min-w-0 items-center gap-2">
            {!isPromptMode && currentChapterIndex > 0 ? <Button type="button" variant="ghost" onClick={() => selectChapter(visibleChapters[currentChapterIndex - 1].id)}>Previous</Button> : null}
            {!isPromptMode && currentChapterIndex < visibleChapters.length - 1 ? <Button type="button" variant="outline" onClick={() => selectChapter(visibleChapters[currentChapterIndex + 1].id)}>Next chapter</Button> : null}
          </div>
          <Button className="codex-studio-primary-action" type="submit" size="lg" disabled={saving} aria-describedby={error ? "character-form-error" : undefined}><Save className="h-4 w-4" />{saving ? "Binding..." : mode === "edit" ? "Save revision" : "Create character"}</Button>
        </footer>
      </form>
    </div>
  );
}

function AdditionalPersonalitiesEditor({
  characters,
  onAdd,
  onChange,
  onRemove
}: {
  characters: AdditionalCharacterDraft[];
  onAdd: () => void;
  onChange: (id: string, field: keyof Omit<AdditionalCharacterDraft, "id">, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="-mt-2 space-y-4" aria-label="Additional character personalities">
      {characters.map((character, index) => (
        <article key={character.id} className="rounded-sm border border-[var(--codex-rule)] bg-black/10 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="codex-kicker">Personality {index + 2}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">A separate hero with their own identity and behavior.</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(character.id)}
              aria-label={`Remove ${character.name.trim() || `personality ${index + 2}`}`}
              className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--text-muted)] transition hover:border-red-400/50 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4">
            <Field label="Character name" required>
              <Input value={character.name} onChange={(event) => onChange(character.id, "name", event.target.value)} placeholder="Mira" minLength={2} required />
            </Field>
            <Field label="Personality" hint="Describe how this hero thinks, reacts, speaks, and carries themselves." required>
              <Textarea
                value={character.personality}
                onChange={(event) => onChange(character.id, "personality", event.target.value)}
                placeholder="Write this hero's complete personality, voice, motivations, and behavioral rules."
                className="min-h-44"
                minLength={20}
                required
              />
            </Field>
          </div>
        </article>
      ))}

      <Button type="button" variant="outline" onClick={onAdd} disabled={characters.length >= 7}>
        <Plus className="h-4 w-4" />
        {characters.length ? "Add another personality" : "Add personality"}
      </Button>
      <p className="text-xs leading-5 text-[var(--text-muted)]">
        {characters.length >= 7 ? "Maximum of eight heroes per bot." : "Each added personality becomes another independent hero in the same bot."}
      </p>
    </section>
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

function GeneratedPreviewCard({ preview }: { preview: GeneratedCharacterPreview }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--accent-rgb)_/_0.28)] bg-[var(--accent-purple-soft)] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{preview.name?.trim() || "Generated preview"}</p>
      {preview.description ? <RichMessageText text={preview.description} className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]" /> : null}
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Personality</p>
      <p className="mt-1 line-clamp-4 text-sm leading-6 text-[var(--text-secondary)]">{preview.personality}</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Opening message</p>
      <RichMessageText text={preview.greeting} className="mt-1 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]" />
    </div>
  );
}

function AvatarUpload({
  id,
  value,
  name,
  onChange,
  onError,
  large = false
}: {
  id?: string;
  value: string;
  name: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
  large?: boolean;
}) {
  return (
    <div id={id} tabIndex={id ? -1 : undefined} className="min-w-0 outline-none">
      <ImageFilePicker onPick={onChange} onError={onError}>
        <div
          className={cn(
            "focus-ring flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] p-5 text-center transition hover:border-[var(--accent-purple)] hover:bg-white/[0.045]",
            large ? "min-h-[156px] sm:min-h-[210px]" : "min-h-28"
          )}
        >
          <span
            className={cn(
              "grid place-items-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--accent-purple)]",
              large ? "h-24 w-24 sm:h-32 sm:w-32" : "h-20 w-20"
            )}
          >
            {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : large ? <Upload className="h-8 w-8" /> : <ImagePlus className="h-5 w-5" />}
          </span>
          <span className="mt-3 text-sm text-[var(--text-secondary)]">{value ? "Click to replace image" : "Upload an avatar image"}</span>
          <span className="mt-1 text-xs text-[var(--text-muted)]">JPG, PNG, WebP, GIF, AVIF, or BMP · up to 6 MB</span>
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
  error,
  required,
  children
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {label}
        {required ? <span className="text-[var(--accent-purple)]"> *</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-xs text-[var(--text-muted)]">{hint}</span> : null}
      <span className="mt-2 block min-w-0">{children}</span>
      {error ? <span className="mt-2 block text-xs leading-5 text-[oklch(.78_.12_25)]" role="alert" aria-live="assertive">{error}</span> : null}
    </label>
  );
}

function BehaviorControls({
  draft,
  onSliderChange,
  onMessageLengthChange
}: {
  draft: CharacterFormValue;
  onSliderChange: (field: BehaviorSliderField, value: number) => void;
  onMessageLengthChange: (value: CharacterFormValue["messageLength"]) => void;
}) {
  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="text-sm font-medium text-[var(--text-primary)]">Response length</legend>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Set the usual size of each in-character reply. The scene can still end naturally.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3" aria-label="Response length">
          {RESPONSE_LENGTH_OPTIONS.map((option) => {
            const selected = draft.messageLength === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onMessageLengthChange(option.value)}
                className={cn(
                  "focus-ring rounded-xl border px-4 py-3 text-left transition",
                  selected
                    ? "border-[var(--accent-purple)] bg-[color-mix(in_srgb,var(--accent-purple)_12%,transparent)] text-[var(--text-primary)]"
                    : "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                )}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{option.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-6 sm:grid-cols-2">
        {behaviorSliderFields.map(({ field, label }) => (
          <Slider
            key={field}
            label={label}
            value={draft[field]}
            onChange={(value) => onSliderChange(field, value)}
          />
        ))}
      </div>
    </div>
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
        "focus-ring flex h-10 items-center justify-center gap-2 rounded-sm border font-mono text-[10px] font-medium uppercase tracking-[.12em] transition-colors duration-150 active:scale-[.98]",
        selected ? "border-[var(--codex-mint)]/55 bg-[color-mix(in_oklch,var(--codex-mint)_10%,transparent)] text-[var(--codex-mint)]" : "border-transparent text-[var(--text-secondary)] hover:border-[var(--codex-rule)] hover:text-[var(--text-primary)]"
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
