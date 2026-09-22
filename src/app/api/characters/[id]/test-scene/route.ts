import { z } from "zod";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdultConsent } from "@/lib/adult-consent";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDecryptedProviderKeys } from "@/lib/user-keys";
import { resolveCharacterModelSettings } from "@/lib/character-model-settings";
import { userPreferredModelValue } from "@/lib/provider-model-options";
import { assembleNytheraPrompt } from "@/lib/prompt-assembly";
import { buildPromptAddonLayers } from "@/lib/prompts/buildPrompt";
import { normalizeChatMode } from "@/lib/chat-mode";
import { fitPromptMessagesWithinContext } from "@/lib/prompt-budget";
import { streamLlmResponse } from "@/lib/proxy";
import { resolveChatOutputTokenLimit } from "@/lib/response-length";
import { moderateText } from "@/lib/safety";
import { createPhysicalContinuityOutputGuard } from "@/lib/physical-continuity";
import { localModelSchema } from "@/lib/local-model";

export const maxDuration = 60;
const sceneSchema = z.object({
  scene: z.string().trim().min(1).max(4000),
  persona: z.string().trim().max(4000).default(""),
  localModel: localModelSchema.optional(),
  localOutput: z.string().trim().min(1).max(100000).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    requireAdultConsent(user);
    await enforceRateLimit({ userId: user.id, route: "characters:test-scene" });
    const { id } = await context.params;
    const input = await parseJson(request, sceneSchema);
    const character = await prisma.character.findFirst({ where: { id, creatorId: user.id, blockedAt: null } });
    if (!character) throw new HttpError(404, "Character not found.");
    const moderation = moderateText({ text: input.scene, context: "message" });
    if (!moderation.allowed) throw new HttpError(400, moderation.reason ?? "This test scene cannot be generated.");
    const providerKeys = input.localModel ? [] : await getDecryptedProviderKeys(user.id);
    if (!input.localModel && providerKeys.length === 0)
      throw new HttpError(400, "Connect a model in Settings before running a test scene.");
    const settings = resolveCharacterModelSettings({
      character,
      providerKeys,
      globalModel: userPreferredModelValue(user),
      chatTemperature: character.temperature ?? user.defaultTemperature
    });
    const maxTokens = resolveChatOutputTokenLimit(settings.maxTokens, user.maxOutputTokens);
    const addon = buildPromptAddonLayers({
      mode: normalizeChatMode(character.defaultChatMode),
      characterMemories: [],
      userMemories: []
    });
    const prompt = assembleNytheraPrompt({
      character,
      memories: [],
      recentMessages: [],
      currentMessage: input.scene,
      userPersona: input.persona || null,
      userPersonaContinuity: input.persona || null,
      responsePrompt: user.defaultResponsePrompt,
      modeContext: addon.modeStyle
    });
    const fit = fitPromptMessagesWithinContext(prompt, {
      model: settings.model,
      maxOutputTokens: maxTokens,
      contextWindow: input.localModel?.contextWindow
    });
    if (fit.fixedPromptTooLarge)
      throw new HttpError(
        400,
        "This character exceeds the model's context window. Shorten its instructions or choose a larger context."
      );
    if (input.localModel && !input.localOutput)
      return json(
        {
          local: true,
          request: {
            messages: fit.messages,
            model: input.localModel.model,
            temperature: settings.temperature,
            maxTokens
          }
        },
        { headers: { "cache-control": "private, no-store" } }
      );
    let reply = input.localModel ? (input.localOutput ?? "") : "";
    let actualModel = input.localModel?.model ?? settings.model;
    if (!input.localModel) {
      for await (const chunk of streamLlmResponse({
        messages: fit.messages,
        model: settings.model,
        temperature: settings.temperature,
        topP: settings.topP,
        frequencyPenalty: settings.frequencyPenalty,
        presencePenalty: settings.presencePenalty,
        maxTokens,
        userId: user.id,
        chatId: `test-${character.id}`,
        providerKeys,
        signal: request.signal
      })) {
        if (chunk.type === "delta") reply += chunk.text;
        if (chunk.type === "usage") actualModel = chunk.model;
        if (chunk.type === "error") throw new HttpError(502, chunk.message);
      }
    }
    const guard = createPhysicalContinuityOutputGuard(character, input.persona || null, {
      recentMessages: [],
      currentMessage: input.scene
    });
    const content = guard.push(reply) + guard.flush();
    if (!content.trim()) throw new HttpError(502, "The model returned no visible reply. Try another scene or model.");
    const outputCheck = moderateText({ text: content, context: "assistant" });
    if (!outputCheck.allowed)
      throw new HttpError(400, outputCheck.reason ?? "The reply did not pass the platform safety policy.");
    return json(
      {
        content,
        model: actualModel,
        characterUpdatedAt: character.updatedAt.toISOString(),
        generatedAt: new Date().toISOString()
      },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    return routeError(error);
  }
}
