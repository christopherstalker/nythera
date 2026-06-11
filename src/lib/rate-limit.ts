import { incrementWithExpiry } from "@/lib/redis";

export class RateLimitError extends Error {
  status = 429;

  constructor(message: string) {
    super(message);
  }
}

const PLATFORM_LIMITS = { perMinute: 60, perDay: 1500 };

export async function enforceRateLimit(input: {
  userId?: string;
  ip?: string | null;
  route: string;
}) {
  const limits = PLATFORM_LIMITS;
  const principal = input.userId ? `user:${input.userId}` : `ip:${input.ip ?? "unknown"}`;
  const minute = Math.floor(Date.now() / 60_000);
  const day = new Date().toISOString().slice(0, 10);

  const [minuteCount, dayCount] = await Promise.all([
    incrementWithExpiry(`rl:${input.route}:${principal}:m:${minute}`, 60),
    incrementWithExpiry(`rl:${input.route}:${principal}:d:${day}`, 86_400)
  ]);

  if (minuteCount > limits.perMinute) {
    throw new RateLimitError("Rate limit exceeded. Please wait a minute before sending more messages.");
  }

  if (dayCount > limits.perDay) {
    throw new RateLimitError("Daily platform limit exceeded. Please try again tomorrow.");
  }
}
