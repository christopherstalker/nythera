"use client";

import { useRef } from "react";
import { CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CharacterCreationMode } from "@/lib/character-form-types";

export type CharacterFileImportResult = {
  fileName: string;
  kind: "generated" | "character-card";
  warnings: string[];
};

export function CharacterFileImportPanel({
  targetMode,
  file,
  importing,
  result,
  onTargetModeChange,
  onFileChange,
  onImport
}: {
  targetMode: CharacterCreationMode;
  file: File | null;
  importing: boolean;
  result: CharacterFileImportResult | null;
  onTargetModeChange: (mode: CharacterCreationMode) => void;
  onFileChange: (file: File | null) => void;
  onImport: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="mx-0 mb-5 border-y border-[var(--codex-rule)] bg-[color-mix(in_oklch,var(--codex-ink-raised)_78%,transparent)] px-0 py-4 sm:mx-8 sm:mb-8 sm:px-6 sm:py-5 lg:mx-12">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--codex-rule)] text-[var(--codex-mint)] sm:flex">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="codex-kicker">Import source file</p>
              <h2 className="font-editorial mt-1 text-xl text-[var(--codex-ivory)] sm:text-2xl">Turn an existing dossier into a character</h2>
              <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:block">
                TXT, Markdown, JSON, YAML, DOCX, or text PDF · up to 4 MB. The file is analyzed for this draft and is not stored separately.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Import destination">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[.16em] text-[var(--text-muted)]">Draft into</span>
            <TargetButton label="Guided" selected={targetMode === "simple"} onClick={() => onTargetModeChange("simple")} />
            <TargetButton label="Complete" selected={targetMode === "custom"} onClick={() => onTargetModeChange("custom")} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:min-w-[19rem]">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".txt,.md,.json,.yaml,.yml,.docx,.pdf,text/plain,text/markdown,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />

          {file ? (
            <div className="flex min-w-0 items-center gap-3 border border-[var(--codex-rule)] bg-[var(--codex-ink)] px-3 py-3">
              <FileText className="h-4 w-4 shrink-0 text-[var(--codex-mint)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--text-primary)]">{file.name}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[.12em] text-[var(--text-muted)]">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                className="focus-ring rounded-full p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Remove selected file"
                onClick={() => {
                  if (inputRef.current) inputRef.current.value = "";
                  onFileChange(null);
                }}
                disabled={importing}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="lg" onClick={() => inputRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4" />Choose source file
            </Button>
          )}

          {file ? (
            <Button type="button" size="lg" onClick={onImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Reading and drafting..." : `Create ${targetMode === "simple" ? "Guided" : "Complete"} draft`}
            </Button>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="mt-5 flex items-start gap-3 border-t border-[var(--codex-rule)] pt-4" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--codex-mint)]" />
          <div className="min-w-0 text-sm leading-6 text-[var(--text-secondary)]">
            <p><span className="text-[var(--text-primary)]">Draft ready.</span> {result.fileName} was {result.kind === "character-card" ? "imported directly" : "analyzed by your connected model"}. Review every chapter before creating the character.</p>
            {result.warnings.map((warning) => <p key={warning} className="text-[var(--codex-gold)]">{warning}</p>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TargetButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "focus-ring min-h-10 border px-4 font-mono text-[10px] uppercase tracking-[.14em] transition-colors",
        selected
          ? "border-[var(--codex-mint)]/60 bg-[color-mix(in_oklch,var(--codex-mint)_10%,transparent)] text-[var(--codex-mint)]"
          : "border-[var(--codex-rule)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      )}
    >
      {label}
    </button>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
