import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;

globalThis.fetch = async (resource, options) => {
  const url = new URL(typeof resource === "string" ? resource : (resource.url ?? resource.href));
  if (url.hostname === "127.0.0.1") return originalFetch(resource, options);

  const request = JSON.parse(options.body);
  const text = JSON.stringify({ request, path: url.pathname });
  let events;
  if (url.hostname === "generativelanguage.googleapis.com") {
    events = [{ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] }];
  } else if (url.hostname === "api.anthropic.com") {
    events = [
      {
        type: "message_start",
        message: {
          id: "fixture",
          type: "message",
          role: "assistant",
          content: [],
          usage: { input_tokens: 1, output_tokens: 0 }
        }
      },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
      { type: "message_stop" }
    ];
  } else if (url.hostname === "api.openai.com" || url.hostname === "openrouter.ai") {
    events = [{ choices: [{ index: 0, delta: { content: text }, finish_reason: "stop" }] }];
  } else {
    throw new Error(`Unexpected provider host: ${url.hostname}`);
  }
  return new Response(
    events.map((event) => `${event.type ? `event: ${event.type}\n` : ""}data: ${JSON.stringify(event)}\n\n`).join(""),
    {
      headers: { "content-type": "text/event-stream" }
    }
  );
};

await import("openai/shims/web");
await import("@anthropic-ai/sdk/shims/web");
require("openai/shims/web");
require("@anthropic-ai/sdk/shims/web");
