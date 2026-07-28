import { hasDistributedRateLimitStore, incrementWithExpiry } from "@/lib/redis";

export class RateLimitError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status = 429, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type RateLimitRule = {
  perMinute: number;
  perDay: number;
  message: string;
};

const READ_LIMIT: RateLimitRule = {
  perMinute: 45,
  perDay: 1200,
  message: "You're loading this resource quickly. One moment, then try again."
};

const EXPENSIVE_READ_LIMIT: RateLimitRule = {
  perMinute: 20,
  perDay: 400,
  message: "This resource is expensive to load. One moment, then try again."
};

const REPORT_LIMIT: RateLimitRule = {
  perMinute: 4,
  perDay: 30,
  message: "Too many reports were submitted. Please try again later."
};

const COST_BUDGET: RateLimitRule = {
  perMinute: 16_000,
  perDay: 120_000,
  message: "Your AI token budget is temporarily exhausted."
};

const BRANCH_LIMIT: RateLimitRule = {
  perMinute: 3,
  perDay: 20,
  message: "You're creating story branches quickly. Please wait before trying again."
};

const DEFAULT_LIMIT: RateLimitRule = {
  perMinute: 60,
  perDay: 1500,
  message: "Rate limit exceeded. Please wait a minute before trying again."
};

const MESSAGE_LIMIT: RateLimitRule = {
  perMinute: 20,
  perDay: 500,
  message: "You're sending messages quickly. One moment, then try again."
};

const AI_CREATION_LIMIT: RateLimitRule = {
  perMinute: 10,
  perDay: 120,
  message: "You're using creation tools quickly. One moment, then try again."
};

const WRITE_LIMIT: RateLimitRule = {
  perMinute: 30,
  perDay: 300,
  message: "You're making updates quickly. One moment, then try again."
};

const AUTH_LIMIT: RateLimitRule = {
  perMinute: 10,
  perDay: 120,
  message: "Too many sign-in attempts. Wait a moment and try again."
};

const ROUTE_LIMITS: Record<string, RateLimitRule> = {
  "auth:nextauth": AUTH_LIMIT,
  "auth:register": AUTH_LIMIT,
  "mobile-auth:login": AUTH_LIMIT,
  "mobile-auth:google": AUTH_LIMIT,
  "mobile-auth:register": AUTH_LIMIT,
  "chat:stream": MESSAGE_LIMIT,
  "mobile:chat:message": MESSAGE_LIMIT,
  "rooms:message": MESSAGE_LIMIT,
  "mobile:rooms:message": MESSAGE_LIMIT,
  "proxy:llm": MESSAGE_LIMIT,
  "chats:create": AI_CREATION_LIMIT,
  "mobile:chats:create": AI_CREATION_LIMIT,
  "rooms:create": AI_CREATION_LIMIT,
  "mobile:rooms:create": AI_CREATION_LIMIT,
  "characters:create": AI_CREATION_LIMIT,
  "characters:clone": AI_CREATION_LIMIT,
  "mobile:characters:create": AI_CREATION_LIMIT,
  "characters:generate": AI_CREATION_LIMIT,
  "characters:generate-prompt": AI_CREATION_LIMIT,
  "characters:assist": AI_CREATION_LIMIT,
  "chats:branch": BRANCH_LIMIT,
  "memories:search": MESSAGE_LIMIT,
  "mobile:memories:search": MESSAGE_LIMIT,
  "memories:write": WRITE_LIMIT,
  "mobile:memories:write": WRITE_LIMIT,
  "user-persona:write": WRITE_LIMIT,
  "mobile:user-persona:write": WRITE_LIMIT,
  "stories:canon": WRITE_LIMIT,
  "stories:state": WRITE_LIMIT,
  "stories:narrative": WRITE_LIMIT,
  "stories:continuity": WRITE_LIMIT,
  "stories:safety": WRITE_LIMIT,
  "voice:synthesize": MESSAGE_LIMIT,
  "characters:read": READ_LIMIT,
  "mobile:characters:read": READ_LIMIT,
  "chats:read": READ_LIMIT,
  "mobile:chats:read": READ_LIMIT,
  "rooms:read": READ_LIMIT,
  "shares:read": EXPENSIVE_READ_LIMIT,
  "shares:create": WRITE_LIMIT,
  "characters:rating": WRITE_LIMIT,
  "characters:report": REPORT_LIMIT,
  "messages:report": REPORT_LIMIT,
  "chat:token-budget": COST_BUDGET
};

export async function enforceRateLimit(input: {
  userId?: string;
  ip?: string | null;
  route: string;
  cost?: number;
}) {
  if (process.env.NODE_ENV === "production" && !hasDistributedRateLimitStore()) {
    throw new RateLimitError("Rate limiter is unavailable. Please retry shortly.", 503);
  }

  const limits = ROUTE_LIMITS[input.route] ?? DEFAULT_LIMIT;
  const principal = input.userId ? `user:${input.userId}` : `ip:${input.ip ?? "unknown"}`;
  const now = Date.now();
  const cost = Math.max(1, Math.trunc(input.cost ?? 1));
  const minute = Math.floor(now / 60_000);
  const day = new Date().toISOString().slice(0, 10);

  const [minuteCount, dayCount] = await Promise.all([
    incrementWithExpiry(`rl:${input.route}:${principal}:m:${minute}`, 60, cost),
    incrementWithExpiry(`rl:${input.route}:${principal}:d:${day}`, 86_400, cost)
  ]);

  if (minuteCount > limits.perMinute) {
    throw new RateLimitError(limits.message, 429, secondsUntilNextMinute(now));
  }

  if (dayCount > limits.perDay) {
    throw new RateLimitError("Daily platform limit exceeded. Please try again tomorrow.", 429, secondsUntilNextUtcDay(now));
  }
}

function secondsUntilNextMinute(now: number) {
  return Math.max(1, Math.ceil((60_000 - now % 60_000) / 1000));
}

function secondsUntilNextUtcDay(now: number) {
  const date = new Date(now);
  const nextDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(1, Math.ceil((nextDay - now) / 1000));
}
