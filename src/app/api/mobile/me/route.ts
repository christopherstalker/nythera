import { json, routeError } from "@/lib/api";
import { publicMobileUser, requireMobileUser } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireMobileUser(request);
    return json({ user: publicMobileUser(user) });
  } catch (error) {
    return routeError(error);
  }
}
