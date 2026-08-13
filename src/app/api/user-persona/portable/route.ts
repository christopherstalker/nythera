import { z } from "zod";
import { json, parseJson, requireUser, routeError } from "@/lib/api";
import { userPersonaSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { saveUserPersona } from "@/lib/user-persona-store";

const importSchema = z.object({
  personas: z.array(userPersonaSchema.extend({ label: z.string().trim().min(1).max(80).optional() })).min(1).max(50)
});

export async function GET() {
  try {
    const user = await requireUser();
    const personas = await prisma.userPersona.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
    return json({ format: "nythera-personas-v1", exportedAt: new Date().toISOString(), personas }, {
      headers: { "Content-Disposition": "attachment; filename=nythera-personas.json", "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, importSchema);
    for (const persona of input.personas) {
      await saveUserPersona(user.id, { ...persona, label: persona.label || persona.displayName });
    }
    return json({ imported: input.personas.length }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
