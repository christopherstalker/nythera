import type { LocalRequest } from "@/lib/local-model";

declare global {
  interface Window {
    nytheraDesktop?: {
      platform: string;
      version: string;
      local?: {
        models: (
          engine: "ollama" | "lmstudio",
          token?: string
        ) => Promise<{ ok: true; models: string[] } | { ok: false; error: string }>;
        generate: (
          request: LocalRequest & { engine: "ollama" | "lmstudio"; requestId: string }
        ) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;
        cancel: (requestId: string) => Promise<void>;
        onDelta: (callback: (chunk: { requestId: string; text: string }) => void) => () => void;
      };
    };
  }
}
