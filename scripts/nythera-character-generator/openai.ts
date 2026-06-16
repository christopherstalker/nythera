import OpenAI from "openai";

export type OpenAiChatParams = {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export function createOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it in your environment (or .env) before running the dataset generator."
    );
  }
  // openai SDK reads OPENAI_API_KEY by default.
  return new OpenAI();
}

export async function generateJsonWithOpenAI(params: OpenAiChatParams) {
  const client = createOpenAiClient();
  const res = await client.chat.completions.create({
    model: params.model,
    temperature: params.temperature ?? 0.9,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user }
    ],
    // keep tokens bounded; we generate in chunks anyway
    max_tokens: params.maxOutputTokens ?? 7000,
    response_format: { type: "json_object" }
  });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("No content returned from OpenAI.");
  return content;
}

export async function embedTextOpenAI(params: { model?: string; input: string[] }) {
  const client = createOpenAiClient();
  const res = await client.embeddings.create({
    model: params.model ?? "text-embedding-3-small",
    input: params.input
  });
  return res.data.map((d) => d.embedding);
}

