import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequestIp, HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { measurePrismaOperation } from "@/lib/performance-logger";
import { splitProviderModelValue } from "@/lib/provider-model-options";
import { chatUpdateSchema } from "@/lib/validation";
import { requireAdultConsent } from "@/lib/adult-consent";
import { prepareContinuationTurn } from "@/lib/message-actions";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { id: chatId } = await context.params;
    const user = await requireUser();
    requireAdultConsent(user);
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "chats:read" });
    const chat = await measurePrismaOperation(
      {
        route: "chat:get",
        operation: "load_conversation"
      },
      () =>
        prisma.chat.findFirst({
          where: {
            id: chatId,
            userId: user.id
          },
          select: {
            id: true,
            characterId: true,
            summary: true,
            model: true,
            temperature: true,
            responsePrompt: true,
            chatMode: true,
            appearance: true,
            activeAssistantMessageId: true,
            createdAt: true,
            character: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                visualIdentity: true
              }
            },
            messages: {
              orderBy: [{ createdAt: "desc" }, { sequence: "desc" }, { id: "desc" }],
              take: 200,
              select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
                clientRequestId: true,
                branchSourceMessageId: true,
                model: true,
                provider: true,
                inputTokens: true,
                outputTokens: true,
                estimatedCost: true,
                usageEstimated: true
              }
            }
          }
        }),
      (result) => ({
        found: Boolean(result),
        messageCount: result?.messages.length ?? 0
      })
    );

    if (!chat) {
      throw new HttpError(404, "Chat not found.");
    }

    const chapterNumber = await prisma.chat.count({
      where: {
        userId: user.id,
        characterId: chat.characterId,
        OR: [
   …11697 tokens truncated…plore">
              Explore characters
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/ai-roleplay">What is AI roleplay?</Link>
          </Button>
          <Button asChild variant="outline" className="border-[rgb(255_66_77_/_0.5)] text-[rgb(255_157_163)] hover:border-[rgb(255_122_130)] hover:bg-[rgb(255_66_77_/_0.06)]">
            <a href={PATREON_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              <Heart className="h-4 w-4" />
              Patreon
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function BrowseRoleplayThemes() {
  return (
    <nav aria-label="Browse roleplay themes" className="border-y border-[var(--codex-rule)] py-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="codex-kicker">Find your next story</p>
          <h2 className="font-editorial mt-1 text-3xl font-medium text-[var(--codex-ivory)]">Browse roleplay themes</h2>
        </div>
        <div className="flex max-w-3xl flex-wrap gap-x-5 gap-y-3">
          {DISCOVERY_TAGS.slice(0, 10).map((tag) => (
            <Link
              key={tag.slug}
              href={`/tags/${tag.slug}`}
              className="focus-ring border-b border-[var(--codex-rule)] pb-1 text-xs uppercase tracking-[.14em] text-[var(--text-secondary)] no-underline transition-colors hover:border-[var(--codex-mint)] hover:text-[var(--codex-mint)]"
            >
              {tag.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function RecentChatCard({ chat }: { chat: RecentChat }) {
  const lastMessage = chat.messages.at(-1)?.content;
  const avatarSrc = chat.character.avatarUrl || BRAND_ICON_LARGE;

  return (
    <motion.article
      whileHover={{ y: -4, scale: 1.01 }}
      transition={springSoft}
      className="relative overflow-hidden bg-transparent"
    >
      <Link href={`/chat/${chat.id}`} className="flex items-center gap-3 px-3 py-5 no-underline sm:px-5">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[var(--border-subtle)]">
          <Image
            src={avatarSrc}
            alt={chat.character.name}
            fill
            unoptimized={shouldBypassNextImageOptimization(avatarSrc)}
            sizes="56px"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-editorial truncate text-xl font-medium text-[var(--codex-ivory)]">{chat.character.name}</h3>
          <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
            {toChatPreview(lastMessage || chat.character.description || "Continue chat")}
          </p>
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(var(--color-accent-secondary))] shadow-glow-soft" aria-hidden />
      </Link>
    </motion.article>
  );
}

function HomeCharacterCard({
  character,
  featured = false,
  className
}: {
  character: CharacterSummary;
  featured?: boolean;
  className?: string;
}) {
  const avatarSrc = character.avatarUrl || BRAND_ICON_LARGE;

  return (
    <motion.article
      whileHover={{ y: -6, scale: 1.015 }}
      transition={springSoft}
      className={cn(
        "group relative min-h-[280px] overflow-hidden border-b border-r border-[var(--codex-rule)]",
        featured ? "sm:min-h-[360px] xl:min-h-[420px]" : "xl:min-h-[300px]",
        className
      )}
    >
      <Link href={`/character/${character.id}`} className="absolute inset-0 block overflow-hidden no-underline" aria-label={`Open ${character.name}`}>
        <Image
          src={avatarSrc}
          alt={character.name}
          fill
          unoptimized={shouldBypassNextImageOptimization(avatarSrc)}
          sizes={featured ? "(min-width: 1280px) 33vw, 100vw" : "(min-width: 1280px) 16vw, 50vw"}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 20%" }}
        />
        <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[var(--text-primary)]"
            style={{
              background: "color-mix(in oklch, var(--color-surface) 54%, transparent)",
              backdropFilter: "blur(var(--glass-blur-sm))"
            }}
          >
            <Star className="h-3.5 w-3.5 text-[oklch(var(--color-accent-secondary))]" />
            {(character.ratingAverage ?? 0).toFixed(1)}
          </span>
          {character.isNSFW ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-[var(--text-primary)]"
              style={{ background: "oklch(var(--color-danger) / .74)" }}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              18+
            </span>
          ) : null}
        </div>
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-4"
          style={{
            minHeight: featured ? "64%" : "58%",
            background:
              "linear-gradient(to top, oklch(var(--color-canvas) / .94) 0%, oklch(var(--color-canvas) / .64) 58%, transparent 100%)"
          }}
        >
          <h3 className={cn("font-editorial font-medium leading-tight text-[var(--codex-ivory)]", featured ? "line-clamp-2 text-4xl" : "line-clamp-1 text-2xl")}>
            {character.name}
          </h3>
          <p className={cn("mt-1 text-sm leading-6 text-[var(--text-secondary)]", featured ? "line-clamp-3" : "line-clamp-2")}>
            <RichMessageText text={character.description || "A story waiting to begin."} />
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {character.tags?.slice(0, featured ? 3 : 2).map((tag) => (
              <span
                key={tag}
                className="max-w-[8rem] truncate rounded-full px-2 py-1 text-xs font-medium text-[var(--text-primary)]"
                style={{
                  background: "color-mix(in oklch, var(--color-surface) 44%, transparent)",
                  backdropFilter: "blur(var(--glass-blur-sm))",
                  boxShadow: "var(--glass-highlight)"
                }}
              >
                {displayTagLabel(tag)}
              </span>
            ))}
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Heart className="h-3.5 w-3.5" />
            {character.likes ?? 0}
          </span>
        </div>
      </Link>
    </motion.article>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  href
}: {
  icon: typeof Sparkles;
  title: string;
  href: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="font-editorial flex items-center gap-3 text-4xl font-medium text-[var(--codex-ivory)]">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--codex-mint)]">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)] no-underline hover:text-[var(--text-primary)]">
        View all
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
