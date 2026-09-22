import { defaultModelForProvider } from "@/lib/provider-model-options";

export type ProviderApiFormat = "OPENAI" | "ANTHROPIC" | "GEMINI" | "OPENAI_COMPATIBLE";

export type ProviderPreset = {
  provider: string;
  displayName: string;
  apiFormat: ProviderApiFormat;
  baseUrl: string;
  defaultModel: string;
  placeholder: string;
  description?: string;
};

export const FIRST_CLASS_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    provider: "openai",
    displayName: "OpenAI",
    apiFormat: "OPENAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: defaultModelForProvider("openai"),
    placeholder: "sk-..."
  },
  {
    provider: "anthropic",
    displayName: "Anthropic",
    apiFormat: "ANTHROPIC",
    baseUrl: "",
    defaultModel: defaultModelForProvider("anthropic"),
    placeholder: "sk-ant-..."
  },
  {
    provider: "gemini",
    displayName: "Gemini",
    apiFormat: "GEMINI",
    baseUrl: "",
    defaultModel: defaultModelForProvider("gemini"),
    placeholder: "AIza..."
  },
  {
    provider: "openrouter",
    displayName: "OpenRouter",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: defaultModelForProvider("openrouter"),
    placeholder: "sk-or-v1-..."
  },
  {
    provider: "vercel",
    displayName: "Vercel AI Gateway",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://ai-gateway.vercel.sh/v1",
    defaultModel: defaultModelForProvider("vercel"),
    placeholder: "AI Gateway API key",
    description: "Use an AI Gateway API key from Vercel. One key connects models from multiple providers."
  },
  {
    provider: "together",
    displayName: "Together AI",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.together.ai/v1",
    defaultModel: defaultModelForProvider("together"),
    placeholder: "Together AI API key",
    description: "Connect hosted open models with your Together AI API key."
  },
  {
    provider: "fireworks",
    displayName: "Fireworks AI",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: defaultModelForProvider("fireworks"),
    placeholder: "Fireworks AI API key",
    description: "Connect hosted open models with your Fireworks AI API key."
  },
  {
    provider: "deepseek",
    displayName: "DeepSeek",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.deepseek.com",
    defaultModel: defaultModelForProvider("deepseek"),
    placeholder: "sk-..."
  },
  {
    provider: "mistral",
    displayName: "Mistral",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: defaultModelForProvider("mistral"),
    placeholder: "..."
  },
  {
    provider: "groq",
    displayName: "Groq",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: defaultModelForProvider("groq"),
    placeholder: "gsk_..."
  },
  {
    provider: "xai",
    displayName: "xAI (Grok)",
    apiFormat: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: defaultModelForProvider("xai"),
    placeholder: "xai-..."
  }
];

type ProviderConfig = Omit<ProviderPreset, "placeholder" | "description">;

export function enforceFirstClassProviderConfig<T extends ProviderConfig>(input: T): T | ProviderConfig {
  const provider = input.provider.trim().toLowerCase();
  const preset = FIRST_CLASS_PROVIDER_PRESETS.find((item) => item.provider === provider);

  if (!preset) {
    return input;
  }

  const { placeholder: _placeholder, description: _description, ...config } = preset;
  return config;
}
