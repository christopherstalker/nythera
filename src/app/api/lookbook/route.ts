import { z } from "zod";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { serializeAsset } from "@/lib/chat-media";
import { prisma } from "@/lib/prisma";

const lookbookCreateSchema = z.object({
  assetId: z.string().cuid(),
  title: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(500).optional()
});

const lookbookDeleteSchema = z.object({ lookbookId: z.string().cuid() });

export async function GET() {
  try {
    const user = await requireUser();
    const items = await prisma.lookbookItem.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 60,
      include: { asset: true }
    });
    return json({
      items: items.map((item) => ({
        ...serializeAsset(item.asset),
        lookbookId: item.id,
        title: item.title,
        notes: item.notes
      }))
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, lookbookCreateSchema);
    const asset = await prisma.mediaAsset.findFirst({ where: { id: input.assetId, userId: user.id } });
    if (!asset) throw new HttpError(404, "Image not found.");

    const item = await prisma.lookbookItem.upsert({
      where: { userId_assetId: { userId: user.id, assetId: asset.id } },
      create: { userId: user.id, assetId: asset.id, title: input.title, notes: input.notes || null },
      update: { title: input.title, notes: input.notes || null }
    });
    return json({ item: { ...serializeAsset(asset), lookbookId: item.id, title: item.title, notes: item.notes } }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, lookbookDeleteSchema);
    const deleted = await prisma.lookbookItem.deleteMany({ where: { id: input.lookbookId, userId: user.id } });
    if (!deleted.count) throw new HttpError(404, "Lookbook item not found.");
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
