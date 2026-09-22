# AI gateways and hosted model providers

Open **Settings → Model providers**, expand **Vercel AI Gateway**, **Together AI**, or **Fireworks AI**, enter that service's API key, and save. Nythera verifies the key before saving it using the existing encrypted key storage. Model discovery refreshes automatically; connected services appear in the chat model picker and fallback chain. Multiple keys per service use the existing failover pool.

| Service           | Base URL                                | Bundled default model                     |
| ----------------- | --------------------------------------- | ----------------------------------------- |
| Vercel AI Gateway | `https://ai-gateway.vercel.sh/v1`       | `openai/gpt-5.4`                          |
| Together AI       | `https://api.together.ai/v1`            | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| Fireworks AI      | `https://api.fireworks.ai/inference/v1` | `accounts/fireworks/models/deepseek-v3p1` |

Use a Vercel **AI Gateway API key** from the Gateway dashboard. This user-managed connection uses the key supplied in settings. Keep the full model ID, including the provider or account prefix. Nythera's selected value includes its connection prefix, for example `vercel:anthropic/claude-sonnet-4.6`; only `anthropic/claude-sonnet-4.6` is sent to Vercel.

Vercel's model catalog is public. Nythera checks the authenticated `/v1/credits` endpoint before accepting a key, including when the Vercel endpoint is entered as a custom connection. Verification does not generate text or spend model tokens. A valid key with zero credits can be saved; generation remains subject to the gateway's billing and model access rules.

For another OpenAI-compatible service, such as a hosted LiteLLM proxy, use **Custom connection** with a unique provider ID, its public HTTPS base URL, API key, and model ID. The endpoint must support Bearer authentication, `GET /models`, and streaming `POST /chat/completions`. Gateways requiring additional custom headers or other API formats need a separate adapter. Local and private network endpoints cannot be reached by the hosted app.

Protocol references: [Vercel Chat Completions](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions), [Vercel authenticated credit lookup](https://github.com/vercel/ai/blob/main/packages/gateway/src/gateway-fetch-metadata.ts), [Together compatibility](https://docs.together.ai/docs/inference/openai-compatibility), [Fireworks compatibility](https://docs.fireworks.ai/tools-sdks/openai-compatibility).

Run `pre-commit install` after installing dependencies. The gateway regression suite covers credential checks, official endpoint enforcement, model discovery, model selection, and streamed requests with mocked provider responses; it does not call paid model APIs.
