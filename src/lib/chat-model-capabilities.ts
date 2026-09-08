const NON_CHAT_MODEL =
  /(?:embedding|image|imagen|nano-banana|veo|tts|audio|realtime|transcrib|whisper|moderation|llama-guard|safeguard|content-safety|sora|lyria|robotics|computer-use|rerank|gpt-3\.5-turbo-instruct|(?:^|\/)babbage|(?:^|\/)davinci|:batch$)/i;

export function isTextChatModel(model: string) {
  return Boolean(model.trim()) && !NON_CHAT_MODEL.test(model);
}

export function hasTextOutput(model: unknown) {
  if (!model || typeof model !== "object" || !("architecture" in model)) return true;
  const architecture = model.architecture;
  if (!architecture || typeof architecture !== "object" || !("output_modalities" in architecture)) return true;
  return Array.isArray(architecture.output_modalities) && architecture.output_modalities.includes("text");
}
