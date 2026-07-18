import { requireUser, routeError } from "@/lib/api";
import { createStoryPackage, storyPackageToMarkdown } from "@/lib/stories/story-portability";

type Context = { params: { id: string } };

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const story = await createStoryPackage(context.params.id, user.id);
    const markdown = new URL(request.url).searchParams.get("format") === "markdown";
    const body = markdown ? storyPackageToMarkdown(story) : JSON.stringify(story, null, 2);
    const extension = markdown ? "md" : "json";
    return new Response(body, {
      headers: {
        "content-type": markdown ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="nythera-story-${context.params.id}.${extension}"`,
        "cache-control": "private, no-store"
      }
    });
  } catch (error) {
    return routeError(error);
  }
}
