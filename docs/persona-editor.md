# Persona editor

Settings → Personas uses one editor with three blocks: Appearance, Personality, and Traits. Appearance and traits are optional; personality keeps the existing 10–8,000 character requirement. Name, surname and photo sit above the blocks. Backstory, likes, dislikes and boundaries remain editable inside Personality, including details saved by older editors.

The chat persona panel, including its compact variant, renders the same `PersonaFields` component. Both entry points use the same draft normalization and save payload, preserving appearance, punctuation in list items and visibility. Chat saves additionally include the current chat ID. Field IDs are unique when more than one editor is mounted.

Appearance is stored separately in `UserPersona.appearance`. Apply migration `20260909180000_persona_appearance` before running this version against an existing database. The production deployment build applies pending migrations.

Web and mobile endpoints share the optional appearance schema. Older clients that omit the field preserve its current value. Export/import, normalized profiles and version snapshots include appearance. Older snapshots restore it to null. Existing freeform descriptions stay intact in Personality; the editor does not guess how to split them.

Every generation receives the full selected persona: description, appearance, background, traits, preferences and boundaries. Identity and anatomy may be written as freeform prose in any language. Persona facts take precedence over conflicting character prose and earlier narration, including when a custom system prompt controls the response style. The continuity source also normalizes measurements and handling constraints. Visible features can be noticed naturally and continue to affect relevant interactions without requiring repeated descriptions.

Saving a persona inside a chat makes it the chat's active persona and clears any queued one-reply override. The save response, reloaded selection and next generation therefore use the same profile. Saving from Settings without a chat ID leaves each chat's queued override unchanged.

The provider request preserves the full persona and its paragraph boundaries in an `active_player_persona` block. With the built-in engine, it appears before `current_player_message` in the final user turn. With a custom system prompt, it appears once as standing system context before the custom instructions; the final user turn contains only the player's message. System instructions distinguish the profile from dialogue or a newly disclosed description. Both placements retain the persona when older history is removed to fit the context budget. The envelope is not stored as the user's chat message. Construction tests verify placement and preservation; they do not guarantee that every model response follows the profile.

Regression tests cover legacy preservation, list limits without truncation, normalized round trips, version restoration, older client updates and identity/continuity handling. Browser fixtures cover creation, save/reload, profile switching, failed-save retry and mobile layout.
