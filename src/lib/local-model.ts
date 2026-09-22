import { z } from "zod";

export const localModelSchema = z.object({
  engine: z.enum(["ollama", "lmstudio"]),
  model: z.string().trim().min(1).max(120),
  contextWindow: z.number().int().min(4096).max(1048576)
});
export type LocalModel = z.infer<typeof localModelSchema>;
export type LocalRequest = {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature: number;
  maxTokens?: number | null;
};
export const LOCAL_MODEL_EVENT = "nythera:local-model";
const STORAGE_KEY = "nythera.local-model.v1";

export function readLocalModel(): LocalModel | null {
  if (typeof window === "undefined" || !window.nytheraDesktop?.local) return null;
  try {
    const parsed = localModelSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveLocalModel(selection: LocalModel | null) {
  if (selection) localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(LOCAL_MODEL_EVENT));
}

export async function generateLocally(
  selection: LocalModel,
  request: LocalRequest,
  signal: AbortSignal,
  onDelta: (text: string) => void
) {
  const bridge = window.nytheraDesktop?.local;
  if (!bridge) throw new Error("Open this chat in the updated Nythera Desktop app to use a local model.");
  signal.throwIfAborted();
  const requestId = crypto.randomUUID();
  const unsubscribe = bridge.onDelta((chunk) => {
    if (chunk.requestId === requestId && !signal.aborted) onDelta(chunk.text);
  });
  const cancel = () => {
    void bridge.cancel(requestId);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const completion = await bridge.generate({ ...request, engine: selection.engine, requestId });
    signal.throwIfAborted();
    if (!completion.ok) throw new Error(completion.error);
    return completion.text;
  } finally {
    signal.removeEventListener("abort", cancel);
    unsubscribe();
  }
}
