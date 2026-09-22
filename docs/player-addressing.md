# Player names and narrative perspective

Template substitution and narrative perspective are separate contracts:

- `{{user}}` resolves to the selected persona's display name. `{{user_surname}}` resolves to its surname. Choosing second-person prose must not replace an available name with `you` or discard the surname.
- Authored pronouns remain literal. `Mara turns toward you. "Hello, {{user}}."` renders as `Mara turns toward you. "Hello, Alex."` for a persona named Alex.
- `communicationStyle.prologuePov` controls generated opening prose. It does not change the meaning of template commands or rewrite authored greetings.
- The built-in chat engine uses second-person narration in the response language, including Russian `ты` and its grammatical forms. Dialogue can use the canonical name, subject to the persona's address boundaries.
- Prior greetings, summaries, and replies preserve scene events; their wording cannot override the built-in narrative perspective.
- A custom system prompt replaces built-in behavior and controls its own perspective. Both chat-level and character-level custom prompts resolve template commands before provider handoff.
- Custom system prompts retain paragraph breaks, headings, lists, and indentation. Their trusted instructions are not flattened or rewritten by the sanitizer for retrieved context.
- Persona identity pronouns do not choose narrative perspective. A `she/her` profile remains compatible with `you/your` narration and third-person references in NPC dialogue. The built-in engine reinforces this distinction in the system and current turn.
- With a custom prompt, the complete persona appears once as standing system context, before the custom instructions. It survives history budgeting without being repeated as part of the latest user message. The custom prompt is the final system layer; built-in perspective reminders are excluded. This keeps the profile available for continuity without presenting it as a new topic to describe on every turn.

When no name is available, opening messages retain the existing fallback: `you` for second person and `the newcomer` for third person. Already saved prose is not rewritten; a literal `you` may be intentional or part of a user edit.

## Regression coverage

`tests/prologue-pov.test.ts` checks rendering and persisted greetings through the web and mobile creation routes. `tests/player-addressing.test.ts` checks assembled provider prompts across both chat modes, both custom-prompt sources, and history truncation. Both run in pre-commit.

These tests verify deterministic substitution and the instructions sent to providers. They do not guarantee that every model will follow every prose instruction.
