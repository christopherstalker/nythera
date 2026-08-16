import { get } from "@vercel/blob";
import { HttpError, requireUser, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: (await context.params).id, userId: user.id },
      select: { pathname: true, contentType: true }
    });
    if (!asset) throw new HttpError(404, "Image not found.");

    const blob = await get(asset.pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200) throw new HttpError(404, "Image not found.");

    return new Response(blob.stream, {
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(blob.blob.size),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        ETag: blob.blob.etag
      }
    });
  } catch (error) {
    return routeError(error);
  }
}
