import { z } from "zod";
import { HttpError, getRequestIp, json, requireUser, routeError } from "@/lib/api";
import { isCharacterCardV2Json } from "@/lib/character-card-v2";
import {
  MAX_CHARACTER_SOURCE_FILE_BYTES,
  extractCharacterSourceFile,
  type CharacterSourceFile
} from "@/lib/character-file-import";
import { generateCharacterFromSource } from "@/lib/character-prompt-generation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDecryptedProviderKeys } from "@/lib/user-keys";

export const runtime = "nodejs";
export const maxDuration = 60;

const targetModeSchema = z.enum(["simple", "custom"]);
const MAX_MULTIPART_BODY_BYTES = 4_400_000;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "characters:import"
    });

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BODY_BYTES) {
      throw new HttpError(413, "The uploaded request is too large.");
    }

    const formData = await request.formData().catch(() => {
      throw new HttpError(400, "Invalid file upload.");
    });
    const file = formData.get("file");
    const targetMode = targetModeSchema.parse(formData.get("targetMode"));

    if (!isFileLike(file)) {
      throw new HttpError(400, "Choose a character source file first.");
    }
    if (file.size > MAX_CHARACTER_SOURCE_FILE_BYTES) {
      throw new HttpError(413, "The selected file is larger than 4 MB.");
    }

    const source = await extractCharacterSourceFile(file);
    const fileMeta = {
      name: source.fileName,
      extension: source.extension,
      analyzedCharacters: source.text.length,
      originalCharacters: source.originalCharacterCount,
      truncated: source.truncated
    };

    if (source.extension === "json" && isCharacterCardV2Json(source.text)) {
      return json({
        kind: "character-card",
        characterCardJson: source.text,
        file: fileMeta,
        warnings: source.warnings
      });
    }

    const providerKeys = await getDecryptedProviderKeys(user.id);
    if (providerKeys.length === 0) {
      throw new HttpError(400, "Add an API key in Settings → API Keys before analyzing a document.");
    }

    const generated = await generateCharacterFromSource({
      sourceText: source.text,
      sourceName: source.fileName,
      targetMode,
      userId: user.id,
      providerKeys
    });

    return json({
      kind: "generated",
      generated,
      file: fileMeta,
      warnings: source.warnings
    });
  } catch (error) {
    return routeError(error);
  }
}

function isFileLike(value: FormDataEntryValue | null): value is File & CharacterSourceFile {
  return Boolean(
    value &&
      typeof value !== "string" &&
      typeof value.name === "string" &&
      typeof value.type === "string" &&
      typeof value.size === "number" &&
      typeof value.arrayBuffer === "function"
  );
}
