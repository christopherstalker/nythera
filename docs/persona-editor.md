# Persona editor

Settings → Personas uses one editor with three blocks: Appearance, Personality, and Traits. Appearance and traits are optional; personality keeps the existing 10–8,000 character requirement. Name, surname and photo sit above the blocks. Backstory, likes, dislikes and boundaries remain editable inside Personality, including details saved by older editors.

Appearance is stored separately in `UserPersona.appearance`. Apply migration `20260909180000_persona_appearance` before running this version against an existing database. The production deployment build applies pending migrations.

Web and mobile endpoints share the optional appearance schema. Older clients that omit the field preserve its current value. Export/import, normalized profiles and version snapshots include appearance. Older snapshots restore it to null. Existing freeform descriptions stay intact in Personality; the editor does not guess how to split them.

Appearance feeds the existing continuity source. Explicit identity lines also feed the identity prompt, while physical details stay out of its always-present identity section.

Regression tests cover legacy preservation, list limits without truncation, normalized round trips, version restoration, older client updates and identity/continuity handling. Browser fixtures cover creation, save/reload, profile switching, failed-save retry and mobile layout.
