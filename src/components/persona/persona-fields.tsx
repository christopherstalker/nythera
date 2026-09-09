"use client";

import { useId } from "react";
import { Check, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { personaEditorLines, type PersonaDraft } from "@/lib/user-persona-editor";
import "@/components/settings/user-persona-settings.css";

type PersonaDetails = Pick<
  PersonaDraft,
  "appearance" | "summary" | "traits" | "background" | "likes" | "dislikes" | "boundaries"
>;
const suggestedTraits = ["Curious", "Reserved", "Loyal", "Witty", "Stubborn", "Empathetic"];

export function PersonaFields({
  draft,
  update,
  compact = false
}: {
  draft: PersonaDetails;
  update: <K extends keyof PersonaDetails>(field: K, value: PersonaDetails[K]) => void;
  compact?: boolean;
}) {
  const fieldId = useId();
  const traits = personaEditorLines(draft.traits);
  const invalidTraits = traits.length > 24 || traits.some((trait) => trait.length > 160);
  return (
    <div className={compact ? "persona-blocks persona-blocks-compact" : "persona-blocks"}>
      <section className="persona-block" aria-labelledby={`persona-appearance-title-${fieldId}`}>
        <header>
          <span className="persona-block-number" aria-hidden>
            01
          </span>
          <div>
            <h3 id={`persona-appearance-title-${fieldId}`}>Appearance</h3>
            <p>The details that make your persona recognizable.</p>
          </div>
          <span className="persona-optional">Optional</span>
        </header>
        <label className="sr-only" htmlFor={`persona-appearance-${fieldId}`}>
          Appearance
        </label>
        <Textarea
          id={`persona-appearance-${fieldId}`}
          value={draft.appearance}
          maxLength={8000}
          onChange={(event) => update("appearance", event.target.value)}
          placeholder="Describe their build, hair, eyes, clothing, voice or distinctive features.

A weathered coat, dark curls and ink-stained fingers. Their voice is soft, with a hint of the coast."
          aria-describedby={`persona-appearance-hint-${fieldId}`}
        />
        <div className="persona-field-note" id={`persona-appearance-hint-${fieldId}`}>
          <span>Write only the details that matter to you.</span>
          <span>{draft.appearance.length.toLocaleString()} / 8,000</span>
        </div>
      </section>

      <section className="persona-block" aria-labelledby={`persona-personality-title-${fieldId}`}>
        <header>
          <span className="persona-block-number" aria-hidden>
            02
          </span>
          <div>
            <h3 id={`persona-personality-title-${fieldId}`}>Personality</h3>
            <p>How they think, speak and connect with others.</p>
          </div>
        </header>
        <label className="sr-only" htmlFor={`persona-personality-${fieldId}`}>
          Personality
        </label>
        <Textarea
          id={`persona-personality-${fieldId}`}
          value={draft.summary}
          minLength={10}
          maxLength={8000}
          onChange={(event) => update("summary", event.target.value)}
          placeholder="What drives them? How do they react under pressure? What does it take to earn their trust?

Quiet at first, quick with dry humor once comfortable. They listen closely and rarely make promises they cannot keep."
          aria-describedby={`persona-personality-hint-${fieldId}`}
          required
        />
        <div className="persona-field-note" id={`persona-personality-hint-${fieldId}`}>
          <span>At least 10 characters. A few sentences are enough.</span>
          <span>{draft.summary.length.toLocaleString()} / 8,000</span>
        </div>
        <details className="persona-context">
          <summary>Backstory, preferences & boundaries</summary>
          <div className="persona-context-fields">
            <label>
              Backstory
              <Textarea
                value={draft.background}
                maxLength={3000}
                onChange={(event) => update("background", event.target.value)}
                placeholder="History or context you want to keep."
              />
            </label>
            <label>
              Likes
              <Textarea
                value={draft.likes}
                onChange={(event) => update("likes", event.target.value)}
                placeholder="One preference per line"
              />
            </label>
            <label>
              Dislikes
              <Textarea
                value={draft.dislikes}
                onChange={(event) => update("dislikes", event.target.value)}
                placeholder="One preference per line"
              />
            </label>
            <label>
              Boundaries
              <Textarea
                value={draft.boundaries}
                onChange={(event) => update("boundaries", event.target.value)}
                placeholder="How they should be addressed or treated. One boundary per line."
              />
            </label>
            <p>Lists support up to 24 entries, each up to 160 characters. Existing details are kept when you save.</p>
          </div>
        </details>
      </section>

      <section className="persona-block" aria-labelledby={`persona-traits-title-${fieldId}`}>
        <header>
          <span className="persona-block-number" aria-hidden>
            03
          </span>
          <div>
            <h3 id={`persona-traits-title-${fieldId}`}>Traits</h3>
            <p>The small qualities that shape their choices.</p>
          </div>
          <span className="persona-optional">Optional</span>
        </header>
        <label className="sr-only" htmlFor={`persona-traits-${fieldId}`}>
          Traits
        </label>
        <Textarea
          id={`persona-traits-${fieldId}`}
          value={draft.traits}
          onChange={(event) => update("traits", event.target.value)}
          placeholder="Observant
Slow to trust
Protective of friends"
          aria-invalid={invalidTraits}
          aria-describedby={`persona-traits-hint-${fieldId}`}
        />
        <div className="persona-field-note" id={`persona-traits-hint-${fieldId}`}>
          <span>
            {invalidTraits
              ? "Use up to 24 traits, each no longer than 160 characters."
              : "One trait per line. Short phrases work too."}
          </span>
          <span>{traits.length} / 24</span>
        </div>
        <div className="persona-trait-suggestions" role="group" aria-label="Suggested traits">
          {suggestedTraits.map((trait) => {
            const selected = traits.some((entry) => entry.toLowerCase() === trait.toLowerCase());
            return (
              <button
                type="button"
                key={trait}
                aria-pressed={selected}
                disabled={!selected && traits.length >= 24}
                onClick={() =>
                  update(
                    "traits",
                    (selected
                      ? traits.filter((entry) => entry.toLowerCase() !== trait.toLowerCase())
                      : [...traits, trait]
                    ).join("\n")
                  )
                }
              >
                {selected ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
                {trait}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
