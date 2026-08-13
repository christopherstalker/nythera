"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowUp, BookmarkPlus, LoaderCircle, X } from "lucide-react";
import { motion } from "motion/react";
import { upload } from "@vercel/blob/client";
import { Avatar } from "@/components/ui/avatar";
import { RichTextToolbar } from "@/components/rich-text/rich-text-toolbar";
import type { ProviderModelGroup } from "@/lib/provider-model-options";
import { RESPONSE_PROMPT_EXAMPLES } from "@/lib/response-prompt";
import { springSnappy, springSoft } from "@/lib/motion";
import { applyRichTextFormat, richTextFormatFromShortcut } from "@/lib/rich-text-formatting";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/lib/chat-limits";
import { MAX_CHAT_IMAGE_ATTACHMENTS, type ChatImageAttachment, type LookbookImage } from "@/lib/chat-attachments";
import { prepareChatImage } from "@/lib/chat-image-client";
import { ChatToolsMenu } from "@/components/chat/ChatToolsMenu";

const MAX_RESPONSE_PROMPT_LENGTH = 2000;

type ChatInputProps = {
  chatId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (attachments: ChatImageAttachment[], contentOverride?: string) => Promise<boolean>;
  disabled?: boolean;
  model?: string;
  modelGroups?: ProviderModelGroup[];
  modelLoading?: boolean;
  temperature?: number;
  onModelChange?: (value: string) => void;
  onTemperatureChange?: (value: number) => void;
  responsePrompt?: string;
  onResponsePromptChange?: (value: string) => void;
  translationLanguage?: string;
  onTranslationLanguageChange?: (value: string) => void;
  apiStatus?: string | null;
  personaName?: string | null;
  personaAvatarUrl?: string | null;
  onOpenComposer?: () => void;
};

export function ChatInput({
  chatId,
  value,
  onChange,
  onSubmit,
  disabled = false,
  model,
  modelGroups = [],
  modelLoading = false,
  temperature,
  onModelChange,
  onTemperatureChange,
  responsePrompt,
  onResponsePromptChange,
  translationLanguage,
  onTranslationLanguageChange,
  apiStatus,
  personaName,
  personaAvatarUrl,
  onOpenComposer
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [apiOpen, setApiOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatImageAttachment[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [lookbookOpen, setLookbookOpen] = useState(false);
  const [lookbookLoading, setLookbookLoading] = useState(false);
  const [lookbook, setLookbook] = useState<LookbookImage[]>([]);
  const [macros, setMacros] = useState<Array<{ id: string; name: string; content: string }>>([]);
  const [macroName, setMacroName] = useState("");
  const [macroContent, setMacroContent] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [generatingScene, setGeneratingScene] = useState(false);

  useEffect(() => {
    resize();
  }, [value]);

  useEffect(() => { void fetch("/api/chat-macros").then((response) => response.ok ? response.json() : null).then((body) => setMacros(Array.isArray(body?.macros) ? body.macros : [])); }, []);

  function resize() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const format = richTextFormatFromShortcut(event.key, event.ctrlKey || event.metaKey);
    if (format) {
      event.preventDefault();
      const textarea = event.currentTarget;
      const result = applyRichTextFormat(value, textarea.selectionStart, textarea.selectionEnd, format);
      onChange(result.value);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  async function attachContextFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (file.size > 64_000) {
      setAttachmentStatus("Context files must be smaller than 64KB.");
      return;
    }

    try {
      const contents = await file.text();
      const prefix = value.trimEnd() ? `${value.trimEnd()}\n\n` : "";
      const nextValue = `${prefix}[Attached context: ${file.name}]\n${contents.trim()}`;
      if (nextValue.length > MAX_CHAT_MESSAGE_LENGTH) {
        setAttachmentStatus(`That file would exceed the ${MAX_CHAT_MESSAGE_LENGTH.toLocaleString()} character message limit.`);
        return;
      }
      onChange(nextValue);
      setAttachmentStatus(`${file.name} added to your message.`);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      setAttachmentStatus("That context file could not be read.");
    }
  }

  async function submit() {
    if (disabled || imageUploading) return;
    const normalized = value.trim();
    const macro = normalized.startsWith("/") ? macros.find((entry) => normalized.split(/\s/, 1)[0].slice(1).toLowerCase() === entry.name) : undefined;
    const expanded = normalized.toLowerCase().startsWith("/ooc ")
      ? `[OOC — answer out of character]\n${normalized.slice(5).trim()}`
      : macro
        ? `${macro.content}${normalized.slice(macro.name.length + 1).trim() ? `\n${normalized.slice(macro.name.length + 1).trim()}` : ""}`
        : undefined;
    const accepted = await onSubmit(attachments, expanded);
    if (accepted) {
      setAttachments([]);
      setAttachmentStatus(null);
    }
  }

  async function saveMacro() {
    if (!macroName.trim() || !macroContent.trim()) return;
    const response = await fetch("/api/chat-macros", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: macroName.trim(), content: macroContent.trim() }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) return setAttachmentStatus(body?.error ?? "Could not save macro.");
    setMacros((current) => [...current.filter((entry) => entry.id !== body.macro.id), body.macro].sort((a, b) => a.name.localeCompare(b.name)));
    setMacroName(""); setMacroContent(""); setAttachmentStatus(`/${body.macro.name} saved.`);
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        const audio = new File(chunks, "voice-message.webm", { type: recorder.mimeType || "audio/webm" });
        const form = new FormData();
        form.set("audio", audio);
        form.set("duration", String((Date.now() - recordingStartedRef.current) / 1000));
        setAttachmentStatus("Transcribing voice message...");
        const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
        const body = await response.json().catch(() => null);
        if (!response.ok) return setAttachmentStatus(body?.error ?? "Voice transcription failed.");
        onChange(`${value.trimEnd()}${value.trim() ? "\n" : ""}[Voice tone: ${body.emotion}] ${body.text}`);
        setAttachmentStatus("Voice message transcribed with tone.");
      };
      mediaRecorderRef.current = recorder;
      recordingStartedRef.current = Date.now();
      recorder.start();
      setRecording(true);
      setAttachmentStatus("Recording... tap the microphone again to stop.");
    } catch { setAttachmentStatus("Microphone access is unavailable."); }
  }

  async function generateSceneImage() {
    setGeneratingScene(true);
    setAttachmentStatus("Illustrating the current scene...");
    try {
      const response = await fetch(`/api/chats/${chatId}/scene-image`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ direction: value.trim().slice(0, 500) }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Scene illustration failed.");
      setAttachments((current) => [...current.filter((item) => item.assetId !== body.attachment.assetId), body.attachment].slice(-MAX_CHAT_IMAGE_ATTACHMENTS));
      setAttachmentStatus("Scene illustration attached. Send it or save it to Lookbook.");
    } catch (error) { setAttachmentStatus(error instanceof Error ? error.message : "Scene illustration failed."); }
    finally { setGeneratingScene(false); }
  }

  async function attachImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const available = MAX_CHAT_IMAGE_ATTACHMENTS - attachments.length;
    if (!files.length || available <= 0) return;

    setImageUploading(true);
    setAttachmentStatus("Preparing image…");
    try {
      const uploaded: ChatImageAttachment[] = [];
      for (const source of files.slice(0, available)) {
        const prepared = await prepareChatImage(source);
        const safeName = prepared.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const blob = await upload(`chat-images/${chatId}/${Date.now()}-${safeName}`, prepared.file, {
          access: "private",
          handleUploadUrl: "/api/chat-images/upload",
          clientPayload: JSON.stringify({ chatId })
        });
        const response = await fetch("/api/chat-images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chatId,
            pathname: blob.pathname,
            name: source.name,
            width: prepared.width,
            height: prepared.height
          })
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Image upload failed.");
        uploaded.push(body.attachment as ChatImageAttachment);
      }
      setAttachments((current) => [...current, ...uploaded]);
      setAttachmentStatus(`${uploaded.length} image${uploaded.length === 1 ? "" : "s"} ready.`);
    } catch (error) {
      setAttachmentStatus(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setImageUploading(false);
    }
  }

  async function openLookbook() {
    setLookbookOpen(true);
    setLookbookLoading(true);
    try {
      const response = await fetch("/api/lookbook", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Lookbook could not be loaded.");
      setLookbook(Array.isArray(body.items) ? body.items : []);
    } catch (error) {
      setAttachmentStatus(error instanceof Error ? error.message : "Lookbook could not be loaded.");
    } finally {
      setLookbookLoading(false);
    }
  }

  function attachLookbookImage(image: LookbookImage) {
    if (attachments.some((attachment) => attachment.assetId === image.assetId)) return;
    if (attachments.length >= MAX_CHAT_IMAGE_ATTACHMENTS) {
      setAttachmentStatus(`Attach up to ${MAX_CHAT_IMAGE_ATTACHMENTS} images per message.`);
      return;
    }
    setAttachments((current) => [...current, image]);
    setLookbookOpen(false);
  }

  async function saveToLookbook(attachment: ChatImageAttachment) {
    const suggested = attachment.name?.replace(/\.[^.]+$/, "") || "Saved look";
    const title = window.prompt("Name this look", suggested)?.trim();
    if (!title) return;

    const response = await fetch("/api/lookbook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: attachment.assetId, title })
    });
    const body = await response.json().catch(() => null);
    setAttachmentStatus(response.ok ? `${title} saved to Lookbook.` : body?.error ?? "Could not save this look.");
  }

  const canSend = !disabled && !imageUploading && Boolean(value.trim() || attachments.length) && value.length <= MAX_CHAT_MESSAGE_LENGTH;
  const hasApiControls = Boolean(onModelChange || onTemperatureChange || onResponsePromptChange || onTranslationLanguageChange);
  const currentTemperature = temperature ?? 0.7;
  const modelOptions = modelGroups.flatMap((group) => group.options);
  const hasModelOptions = modelOptions.length > 0;
  const currentModelIsKnown = Boolean(model && modelOptions.some((option) => option.value === model));
  const visibleModelGroups = useMemo(
    () => filterModelGroups(modelGroups, modelSearch),
    [modelGroups, modelSearch]
  );
  const visibleModelCount = visibleModelGroups.reduce((count, group) => count + group.options.length, 0);
  const modelLabel = modelLoading ? "Loading" : formatModelLabel(model ?? "Model");

  return (
    <div className="pointer-events-none sticky bottom-0 z-20 shrink-0 border-t border-white/10 bg-gradient-to-t from-black/75 via-black/55 to-transparent px-4 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-7 md:px-10 md:pb-4">
      {hasApiControls && apiOpen ? (
        <motion.div
          className="api-panel-enter pointer-events-auto mx-auto mb-3 grid max-w-[var(--chat-max-width)] gap-3 rounded-sm border border-white/10 bg-[#090909]/95 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          {onModelChange ? (
            <label className="grid gap-1">
              <span className="px-1 text-[11px] font-medium uppercase text-[var(--text-muted)]">Model</span>
              <input
                type="search"
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                placeholder="Search provider or model"
                aria-label="Search provider models"
                disabled={modelLoading || !hasModelOptions}
                className="focus-ring h-9 rounded-sm border border-white/15 bg-[#111] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-purple)] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <select
                value={model ?? ""}
                onChange={(event) => onModelChange(event.target.value)}
                disabled={modelLoading || !hasModelOptions}
                className="focus-ring h-10 rounded-sm border border-white/15 bg-[#111] px-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent-purple)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {modelLoading ? <option value="">Loading saved providers...</option> : null}
                {!modelLoading && !hasModelOptions ? <option value="">No saved providers</option> : null}
                {!modelLoading && model && !currentModelIsKnown ? (
                  <option value={model} disabled>
                    Current model unavailable: {model}
                  </option>
                ) : null}
                {!modelLoading && hasModelOptions && visibleModelCount === 0 ? <option value="">No matching models</option> : null}
                {visibleModelGroups.map((group) => (
                  <optgroup
                    key={group.provider}
                    label={`${group.displayName}${group.last4 ? ` · key ••••${group.last4}` : ""}${group.isDefault ? " · primary" : ""}`}
                  >
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {!modelLoading && !hasModelOptions ? (
                <a href="/settings/providers" className="px-1 text-xs font-medium text-[var(--accent-purple)] hover:underline">
                  Add a provider key in Settings
                </a>
              ) : (
                <span className="px-1 text-[11px] text-[var(--text-muted)]">
                  {modelSearch.trim()
                    ? `${visibleModelCount} matching model${visibleModelCount === 1 ? "" : "s"}.`
                    : `Showing all ${visibleModelCount} available models.`}
                </span>
              )}
            </label>
          ) : null}
          {onTemperatureChange ? (
            <label className="grid gap-1">
              <span className="px-1 text-[11px] font-medium uppercase text-[var(--text-muted)]">Temperature</span>
              <span className="flex h-10 items-center gap-2 rounded-sm border border-white/15 bg-[#111] px-3 text-xs text-[var(--text-secondary)]">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={currentTemperature}
                  onChange={(event) => onTemperatureChange(Number(event.target.value))}
                  className="min-w-0 flex-1 accent-[var(--accent-purple)]"
                />
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={currentTemperature.toFixed(1)}
                  onChange={(event) => onTemperatureChange(Math.min(2, Math.max(0, Number(event.target.value) || 0)))}
                  className="w-14 rounded-lg border border-[var(--border-default)] bg-transparent px-1.5 py-1 text-right text-[var(--text-primary)] outline-none"
                />
              </span>
            </label>
          ) : null}
          {onTranslationLanguageChange ? (
            <label className="grid gap-1 sm:col-span-2">
              <span className="px-1 text-[11px] font-medium uppercase text-[var(--text-muted)]">Automatic translation</span>
              <select value={translationLanguage ?? ""} onChange={(event) => onTranslationLanguageChange(event.target.value)} className="focus-ring h-10 rounded-sm border border-white/15 bg-[#111] px-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent-purple)]">
                <option value="">Character&apos;s natural language</option>
                <option value="English">English</option>
                <option value="Ukrainian">Ukrainian</option>
                <option value="Russian">Russian</option>
                <option value="German">German</option>
                <option value="French">French</option>
                <option value="Spanish">Spanish</option>
                <option value="Japanese">Japanese</option>
              </select>
            </label>
          ) : null}
          {onResponsePromptChange ? (
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="flex items-center justify-between gap-3 px-1 text-[11px] font-medium uppercase text-[var(--text-muted)]">
                <span>Response instructions</span>
                <span>Saved for this chat and used by future chats · {(responsePrompt ?? "").length}/{MAX_RESPONSE_PROMPT_LENGTH}</span>
              </span>
              <textarea
                value={responsePrompt ?? ""}
                onChange={(event) => onResponsePromptChange(event.target.value.slice(0, MAX_RESPONSE_PROMPT_LENGTH))}
                placeholder="Example: Write 2–4 immersive paragraphs, lead with dialogue, and never narrate my actions."
                rows={3}
                className="focus-ring min-h-20 resize-y rounded-sm border border-white/15 bg-[#111] px-3 py-2 text-xs leading-5 text-[var(--text-primary)] focus:border-[var(--accent-purple)]"
              />
              <p className="px-1 text-xs leading-5 text-[var(--text-muted)]">
                Tip: specify reply length, point of view, pacing, dialogue/action balance, or formatting. Character and safety rules always stay in control.
              </p>
              <span className="flex flex-wrap gap-1.5 px-1">
                {RESPONSE_PROMPT_EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => onResponsePromptChange(example.prompt)}
                    className="focus-ring rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                  >
                    {example.label}
                  </button>
                ))}
              </span>
            </label>
          ) : null}
          <div className="grid gap-2 sm:col-span-2">
            <span className="px-1 text-[11px] font-medium uppercase text-[var(--text-muted)]">Slash commands & macros</span>
            <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_auto]"><input value={macroName} onChange={(event) => setMacroName(event.target.value.replace(/[^a-z0-9_-]/gi, ""))} placeholder="command" className="focus-ring h-10 border border-white/15 bg-[#111] px-3 text-xs" /><input value={macroContent} onChange={(event) => setMacroContent(event.target.value)} placeholder="Text inserted by /command" className="focus-ring h-10 border border-white/15 bg-[#111] px-3 text-xs" /><button type="button" onClick={() => void saveMacro()} className="focus-ring h-10 border border-white/15 px-3 text-xs text-[var(--accent-mint)]">Save macro</button></div>
            <p className="px-1 text-xs text-[var(--text-muted)]">Built in: <button type="button" onClick={() => onChange("/ooc ")} className="text-[var(--accent-purple)]">/ooc</button>{macros.map((macro) => <button key={macro.id} type="button" onClick={() => onChange(`/${macro.name} `)} className="ml-2 text-[var(--accent-purple)]">/{macro.name}</button>)}</p>
          </div>
          {apiStatus ? <p className="px-1 text-xs text-[var(--text-muted)] sm:col-span-2">{apiStatus}</p> : null}
        </motion.div>
      ) : null}
      <motion.div
        className="composer-dock pointer-events-auto relative mx-auto flex w-full max-w-[var(--chat-content-width,1000px)] flex-col gap-2 border border-white/15 bg-black/75 px-4 py-3 sm:px-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
      >
        {attachments.length ? (
          <div className="flex gap-2 overflow-x-auto border-b border-[var(--border-subtle)] pb-2" aria-label="Attached images">
            {attachments.map((attachment) => (
              <div key={attachment.assetId} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-sm border border-white/15 bg-black/50">
                <img src={attachment.url} alt={attachment.name || "Attached image"} className="h-full w-full object-cover" />
                <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" onClick={() => void saveToLookbook(attachment)} className="focus-ring grid h-7 w-7 place-items-center rounded-full bg-black/80 text-white" aria-label="Save to Lookbook">
                    <BookmarkPlus className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.assetId !== attachment.assetId))} className="focus-ring grid h-7 w-7 place-items-center rounded-full bg-black/80 text-white" aria-label="Remove image">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {lookbookOpen ? (
          <div className="absolute inset-x-0 bottom-full z-30 mb-2 max-h-72 overflow-y-auto rounded-sm border border-white/15 bg-[#090909]/98 p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--codex-mint)]">Lookbook</p>
              <button type="button" onClick={() => setLookbookOpen(false)} className="focus-ring grid h-8 w-8 place-items-center text-[var(--text-secondary)]" aria-label="Close Lookbook"><X className="h-4 w-4" /></button>
            </div>
            {lookbookLoading ? (
              <p className="py-8 text-center text-xs text-[var(--text-muted)]">Loading saved looks…</p>
            ) : lookbook.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {lookbook.map((image) => (
                  <button key={image.lookbookId} type="button" onClick={() => attachLookbookImage(image)} className="focus-ring overflow-hidden rounded-sm border border-white/10 bg-white/5 text-left hover:border-[var(--codex-mint)]">
                    <img src={image.url} alt={image.title} className="aspect-square w-full object-cover" />
                    <span className="block truncate px-2 py-1.5 text-[11px] text-[var(--text-secondary)]">{image.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-[var(--text-muted)]">Save an attached image here to reuse the look later.</p>
            )}
          </div>
        ) : null}

        <RichTextToolbar
          textareaRef={textareaRef}
          value={value}
          onChange={onChange}
          compact
          className="relative border-b border-[var(--border-subtle)] pb-2"
        />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            onChange={(event) => onChange(event.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH))}
            onInput={resize}
            onKeyDown={handleKeyDown}
            placeholder="Write what happens next…"
            className="relative max-h-[220px] min-h-16 w-full flex-1 resize-none overflow-y-auto bg-transparent px-0 py-1 text-[length:var(--chat-font-size,24px)] font-[var(--chat-font-weight,500)] leading-[var(--chat-line-height,1.5)] text-[var(--chat-text-color,var(--codex-ivory))] outline-none placeholder:italic placeholder:text-[var(--text-muted)] sm:min-h-8"
            style={{ fontFamily: "var(--chat-font-family, var(--font-editorial))" }}
            disabled={disabled}
          />

          <div className="relative flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <div className="flex min-w-0 items-center sm:hidden">
              {onOpenComposer ? (
                <motion.button
                  type="button"
                  aria-label="Open memory, history, and persona"
                  onClick={onOpenComposer}
                  whileTap={{ scale: 0.94 }}
                  transition={springSnappy}
                  className="focus-ring flex h-10 min-w-0 items-center gap-2 rounded-sm border border-[var(--codex-rule)] bg-transparent px-2.5 pr-3 text-sm font-semibold text-[var(--text-secondary)]"
                >
                  <Avatar name={personaName ?? "You"} src={personaAvatarUrl} size="xs" className="h-7 w-7 border-0 bg-transparent" />
                  <span className="max-w-[116px] truncate">{personaName ?? "You"}</span>
                </motion.button>
              ) : null}
            </div>

            <div className="relative flex shrink-0 items-center gap-2">
              <ChatToolsMenu
                open={toolsOpen}
                onOpenChange={setToolsOpen}
                attachmentCount={attachments.length}
                imageUploading={imageUploading}
                imageLimitReached={attachments.length >= MAX_CHAT_IMAGE_ATTACHMENTS}
                generatingScene={generatingScene}
                recording={recording}
                modelLoading={modelLoading}
                modelLabel={modelLabel}
                hasApiControls={hasApiControls}
                onAttachImages={attachImages}
                onAttachContextFile={attachContextFile}
                onOpenLookbook={() => void openLookbook()}
                onGenerateScene={() => void generateSceneImage()}
                onToggleRecording={() => void toggleRecording()}
                onOpenApiSettings={() => setApiOpen((current) => !current)}
              />

              <motion.button
                type="button"
                onClick={() => void submit()}
                disabled={!canSend}
                aria-label="Send message"
                whileTap={canSend ? { scale: 0.92 } : undefined}
                transition={springSnappy}
                className="focus-ring relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--codex-mint)] text-[var(--codex-mint)] disabled:cursor-not-allowed disabled:opacity-45"
                style={{ background: canSend ? "oklch(var(--color-accent-secondary) / .08)" : "transparent" } as CSSProperties}
              >
                <ArrowUp className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>
        <div className="relative flex items-center justify-between gap-3 px-1 text-xs text-[var(--text-muted)]">
          <p role="status">{attachmentStatus}</p>
          <span className={value.length >= MAX_CHAT_MESSAGE_LENGTH ? "text-amber-300" : undefined}>
            {value.length.toLocaleString()}/{MAX_CHAT_MESSAGE_LENGTH.toLocaleString()}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function filterModelGroups(groups: ProviderModelGroup[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return groups.flatMap((group) => {
    const providerMatches = group.displayName.toLowerCase().includes(normalizedQuery) || group.provider.toLowerCase().includes(normalizedQuery);
    const options = normalizedQuery
      ? group.options.filter((option) => providerMatches || option.model.toLowerCase().includes(normalizedQuery))
      : group.options;

    return options.length ? [{ ...group, options }] : [];
  });
}

function formatModelLabel(value: string) {
  return value
    .replace(/^openai:/, "")
    .replace(/^anthropic:/, "")
    .replace(/^google:/, "")
    .replace(/^gemini:/, "")
    .replace(/^deepseek:/, "")
    .replace(/^xai:/, "")
    .replace(/^openrouter:/, "")
    .replace(/-/g, " ");
}
