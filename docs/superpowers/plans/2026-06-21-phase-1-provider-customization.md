# Nythera Phase 1 Provider Customization

Approved behavior: when a character's preferred provider is unavailable to the chatting user, use that user's global provider and model. Never use another user's saved key.

## Delivery slices

1. Add Mistral, Groq, and xAI provider presets and dedicated key cards using the existing encrypted key flow.
2. Validate the generic OpenAI-compatible endpoint contract and keep both gateway implementations aligned.
3. Add nullable character provider/model/sampler/system-prompt fields and expose them in the Advanced editor.
4. Add an ordered, optional fallback chain; retry only rate limits, timeouts, network failures, and 5xx responses.
5. Persist provider usage and estimated USD cost on assistant messages, preferring provider-returned usage over estimates.
6. Verify desktop/mobile API parity, proxy parity, security, build, and end-to-end behavior before shipping.

## Approved additive migration

- `Character`: `preferredProvider`, `preferredModel`, `temperature`, `topP`, `frequencyPenalty`, `presencePenalty`, `maxTokens`, `systemPromptOverride`.
- `UserApiKey`: `fallbackEnabled`, `fallbackPriority`.
- `Message`: `provider`, `inputTokens`, `outputTokens`, `estimatedCost`, `usageEstimated`.

All character and message additions are nullable. Existing key rows remain enabled for fallback, preserving current behavior until the user reorders or disables providers.
