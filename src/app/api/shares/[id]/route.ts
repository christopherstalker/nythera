import { HttpError, json, routeError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: Context) {
  try {
    const share = await prisma.chatShare.findUnique({
      where: { id: context.params.id }
    });

    if (!share || (share.expiresAt && share.expiresAt.getTime() < Date.now())) {
      throw new HttpError(404, "Share not found.");
    }

    return json({ share });
  } catch (error) {
    return routeError(error);
  }
}
