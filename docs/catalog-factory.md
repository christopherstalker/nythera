# Catalog factory

Nythera's catalog factory turns curated source dossiers into private character drafts. It does not generate subjects at random and never publishes automatically.

## Pipeline

1. A source manifest supplies the subject, origin category, reference URLs, and a factual brief.
2. A research-editor pass separates canonical facts from creative roleplay design.
3. An author pass writes the character card, scene engine, voice, and lorebook.
4. A critic scores canonical fidelity, voice, scene quality, consistency, player agency, and generic AI phrasing.
5. Weak cards receive one revision pass and a second review.
6. Only `READY_FOR_HUMAN_REVIEW` records can be imported, always with `PRIVATE` visibility.

The interface displays an AI label on every character. Real-person and fan interpretations receive stronger, origin-specific disclosure text.

## Prepare sources

Copy [the example manifest](../data/character-sources.example.json) and write one dossier per desired character. The `referenceBrief` must contain the facts the model may use; URLs provide provenance for the human reviewer. The generator is instructed not to fill gaps from model memory.

Supported origin types:

- `ORIGINAL`
- `PUBLIC_DOMAIN`
- `LICENSED`
- `FAN_INTERPRETATION`
- `REAL_PERSON`
- `HISTORICAL_FIGURE`

For `REAL_PERSON`, explicitly set `isLiving` and keep the brief limited to documented public information. The generated portrayal remains fictional and unofficial.

## Generate

Keep `OPENAI_API_KEY` in the environment or an ignored `.env` file.

```powershell
npm run characters:factory -- --input data/character-sources.json --batch launch-01 --limit 20
```

Useful options:

- `--model <model>` selects the generation model.
- `--out <file>` changes the resumable output file.
- `--skip-revision` disables the automatic revision pass for a cheaper dry run.

The command saves after every completed character. Running it again with the same output file resumes by source ID.

## Import private drafts

Apply the Prisma migration, then import reviewed output into the owner account:

```powershell
npm run prisma:migrate
npm run characters:factory:import -- data/character-factory/launch-01.json creator@example.com
```

Rejected and revision-needed records are skipped. Imported records retain their source, batch, blueprint, model, and QA report. Opening, testing, adding an avatar, and publishing each character remain deliberate human steps.
