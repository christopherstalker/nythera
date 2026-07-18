"use client";

import { useState } from "react";
import { FormattedTextarea } from "@/components/rich-text/formatted-textarea";

const STARTER_POST = "*She closes the archive and looks up.*\n> You came back. **Why?**\n(almost too quietly to hear)";

export function FormattingPlayground() {
  const [value, setValue] = useState(STARTER_POST);

  return (
    <section aria-labelledby="playground-heading" className="mt-10 border-y border-[var(--codex-rule)] py-7 sm:py-9">
      <div className="grid gap-6 lg:grid-cols-[minmax(240px,.55fr)_minmax(0,1.45fr)] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--codex-violet)]">Interactive practice</p>
          <h2 id="playground-heading" className="font-editorial mt-2 text-3xl text-[var(--codex-ivory)]">Try the toolbar</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
            Select any phrase, combine multiple styles, or write your own post. The preview below uses the exact renderer used by chat and character subtitles.
          </p>
        </div>
        <FormattedTextarea
          aria-label="Roleplay formatting playground"
          value={value}
          onChange={setValue}
          rows={4}
          className="min-h-36 font-editorial text-lg leading-7"
          previewLabel="Live roleplay preview"
        />
      </div>
    </section>
  );
}
