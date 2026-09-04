import { json, requireUser, routeError } from "@/lib/api";
import { getUserTagOptions } from "@/lib/tag-library";

export async function GET() {
  try {
    const user = await requireUser();
    const tags = await getUserTagOptions(user.id);
    return json({ tags }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
