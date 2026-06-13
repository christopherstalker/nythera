import { detectPromptInjection } from "@/lib/prompt-security";

const BLOCK_PATTERNS = [
  {
    flag: "sexual_content",
    pattern: /\b(explicit sex|porn|nude|nudes|sexual roleplay|erotic|incest|minor sex|underage)\b/i
  },
  {
    flag: "self_harm",
    pattern: /\b(kill myself|suicide|self harm|hurt myself|end my life)\b/i
  },
  {
    flag: "hate",
    pattern: /\b(genocide|racial slur|exterminate (all|the)|white power)\b/i
  },
  {
    flag: "dangerous_violence",
    pattern: /\b(build a bomb|make explosives|poison someone|hide a body|mass shooting)\b/i
  }
];

export type ModerationResult = {
  allowed: boolean;
  flags: string[];
  reason?: string;
  crisis?: boolean;
};

export function moderateText(input: {
  text: string;
  userIsMinor?: boolean;
  context?: "character" | "message" | "assistant";
}): ModerationResult {
  const flags = BLOCK_PATTERNS.filter(({ pattern }) => pattern.test(input.text)).map(({ flag }) => flag);

  if (input.userIsMinor && /\b(romance|dating|kiss|sexual|seduce|flirt)\b/i.test(input.text)) {
    flags.push("minor_romantic_content");
  }

  const injection = detectPromptInjection(input.text);
  if (injection.detected) {
    flags.push("prompt_injection_attempt");
    flags.push(...injection.flags);
  }

  const selfHarm = flags.includes("self_harm");
  if (flags.some((flag) => flag !== "prompt_injection_attempt")) {
    return {
      allowed: false,
      flags,
      crisis: selfHarm,
      reason: selfHarm
        ? "I cannot help with self-harm. If you are in immediate danger, call your local emergency number. In the U.S. or Canada, call or text 988 for crisis support."
        : "This content is blocked by the platform safety policy."
    };
  }

  return {
    allowed: true,
    flags
  };
}

export function sanitizeUserText(text: string, maxLength = 4000) {
  return text.replace(/\u0000/g, "").trim().slice(0, maxLength);
}
