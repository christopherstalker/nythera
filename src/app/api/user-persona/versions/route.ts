import { z } from "zod";
import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { listPersonaRevisions, restorePersonaRevision } from "@/lib/user-persona-store";

const restoreSchema = z.object({ personaId: z.string().cuid(), revisionId: z.string().cuid() });

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const personaId = z.string().cuid().parse(new URL(request.url).searchParams.get("personaId"));
    return json({ revisions: await listPersonaRevisions(user.id, personaId) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, restoreSchema);
    return json({ persona: await restorePersonaRevision(user.id, input.personaId, input.revisionId) });
  } catch (error) {
    return routeError(error);
  }
}
