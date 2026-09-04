import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { redis } from "@/lib/redis";
import {
  OAUTH_PROVIDER_IDS,
  type OAuthProviderId
} from "@/lib/oauth-provider-ids";

const TRANSACTION_TTL_SECONDS = 5 * 60;
const TRANSACTION_KEY_PREFIX = "auth:pwa:v1:";

const providerSchema = z.enum(OAUTH_PROVIDER_IDS);
const transactionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
const nonceSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const transactionRecordSchema = z.object({
  version: z.literal(1),
  provider: providerSchema,
  callbackPath: z.string().min(1).max(2048),
  nonceHash: z.string().length(64),
  status: z.enum(["pending", "ready"]),
  userId: z.string().min(1).optional(),
  createdAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().optional()
});

type TransactionRecord = z.infer<typeof transactionRecordSchema>;
type MemoryTransaction = {
  record: TransactionRecord;
  expiresAt: number;
};

const memoryTransactions = new Map<string, MemoryTransaction>();

const COMPLETE_TRANSACTION_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then
  return "error:missing"
end

local record = cjson.decode(raw)
if record.status == "ready" then
  if record.userId == ARGV[1] then
    return "ready"
  end
  return "error:claimed"
end

if record.status ~= "pending" then
  return "error:invalid"
end

local ttl = redis.call("TTL", KEYS[1])
if ttl <= 0 then
  return "error:missing"
end

record.status = "ready"
record.userId = ARGV[1]
record.completedAt = tonumber(ARGV[2])
redis.call("SET", KEYS[1], cjson.encode(record), "EX", ttl)
return "ready"
`;

const CONSUME_TRANSACTION_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then
  return "error:missing"
end

local record = cjson.decode(raw)
if record.status ~= "ready" or not record.userId then
  return "error:not-ready"
end

if record.nonceHash ~= ARGV[1] then
  return "error:invalid"
end

redis.call("DEL", KEYS[1])
return record.userId
`;

export class PwaAuthTransactionError extends Error {
  constructor(
    public code:
      | "store-unavailable"
      | "missing"
      | "invalid"
      | "not-ready"
      | "claimed",
    message: string
  ) {
    super(message);
  }
}

function transactionKey(transactionId: string) {
  return `${TRANSACTION_KEY_PREFIX}${transactionId}`;
}

function hashNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

function nonceMatches(expectedHash: string, nonce: string) {
  const actual = Buffer.from(hashNonce(nonce));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function assertStoreAvailable() {
  if (process.env.NODE_ENV === "production" && !redis) {
    throw new PwaAuthTransactionError(
      "store-unavailable",
      "Secure sign-in handoff is temporarily unavailable."
    );
  }
}

function readMemoryTransaction(transactionId: string) {
  const entry = memoryTransactions.get(transactionId);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    memoryTransactions.delete(transactionId);
    return null;
  }

  return entry;
}

async function readTransaction(transactionId: string) {
  assertStoreAvailable();

  if (!redis) {
    return readMemoryTransaction(transactionId)?.record ?? null;
  }

  const raw = await redis.get<unknown>(transactionKey(transactionId));
  if (!raw) {
    return null;
  }

  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const parsed = transactionRecordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function createPwaAuthTransaction(input: {
  provider: OAuthProviderId;
  callbackPath: string;
}) {
  assertStoreAvailable();
  const provider = providerSchema.parse(input.provider);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const transactionId = randomBytes(24).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const createdAt = Date.now();
    const record: TransactionRecord = {
      version: 1,
      provider,
      callbackPath: input.callbackPath,
      nonceHash: hashNonce(nonce),
      status: "pending",
      createdAt
    };

    if (redis) {
      const stored = await redis.set(
        transactionKey(transactionId),
        JSON.stringify(record),
        { ex: TRANSACTION_TTL_SECONDS, nx: true }
      );
      if (!stored) {
        continue;
      }
    } else {
      if (memoryTransactions.has(transactionId)) {
        continue;
      }
      memoryTransactions.set(transactionId, {
        record,
        expiresAt: createdAt + TRANSACTION_TTL_SECONDS * 1000
      });
    }

    return {
      transactionId,
      nonce,
      callbackPath: record.callbackPath,
      expiresAt: createdAt + TRANSACTION_TTL_SECONDS * 1000,
      expiresIn: TRANSACTION_TTL_SECONDS
    };
  }

  throw new PwaAuthTransactionError(
    "store-unavailable",
    "Secure sign-in handoff could not be created."
  );
}

export async function getPwaAuthTransactionForStart(transactionId: string) {
  const validTransactionId = transactionIdSchema.parse(transactionId);
  const record = await readTransaction(validTransactionId);
  if (!record || record.status !== "pending") {
    throw new PwaAuthTransactionError("missing", "This sign-in request has expired.");
  }

  return {
    provider: record.provider,
    callbackPath: record.callbackPath
  };
}

export async function getPwaAuthTransactionForCompletion(transactionId: string) {
  const validTransactionId = transactionIdSchema.parse(transactionId);
  const record = await readTransaction(validTransactionId);
  if (!record) {
    throw new PwaAuthTransactionError("missing", "This sign-in request has expired.");
  }

  return {
    provider: record.provider
  };
}

export async function getPwaAuthTransactionStatus(
  transactionId: string,
  nonce: string
) {
  const validTransactionId = transactionIdSchema.parse(transactionId);
  const validNonce = nonceSchema.parse(nonce);
  const record = await readTransaction(validTransactionId);
  if (!record) {
    return "expired" as const;
  }

  if (!nonceMatches(record.nonceHash, validNonce)) {
    throw new PwaAuthTransactionError("invalid", "Invalid sign-in handoff.");
  }

  return record.status;
}

export async function completePwaAuthTransaction(
  transactionId: string,
  userId: string
) {
  assertStoreAvailable();
  const validTransactionId = transactionIdSchema.parse(transactionId);

  if (redis) {
    const result = await redis.eval<string[], string>(
      COMPLETE_TRANSACTION_SCRIPT,
      [transactionKey(validTransactionId)],
      [userId, String(Date.now())]
    );

    if (result === "ready") {
      return;
    }
    if (result === "error:claimed") {
      throw new PwaAuthTransactionError(
        "claimed",
        "This sign-in request belongs to another account."
      );
    }
    throw new PwaAuthTransactionError("missing", "This sign-in request has expired.");
  }

  const entry = readMemoryTransaction(validTransactionId);
  if (!entry) {
    throw new PwaAuthTransactionError("missing", "This sign-in request has expired.");
  }

  if (entry.record.status === "ready") {
    if (entry.record.userId === userId) {
      return;
    }
    throw new PwaAuthTransactionError(
      "claimed",
      "This sign-in request belongs to another account."
    );
  }

  entry.record = {
    ...entry.record,
    status: "ready",
    userId,
    completedAt: Date.now()
  };
}

export async function consumePwaAuthTransaction(
  transactionId: string,
  nonce: string
) {
  assertStoreAvailable();
  const validTransactionId = transactionIdSchema.parse(transactionId);
  const validNonce = nonceSchema.parse(nonce);
  const nonceHash = hashNonce(validNonce);

  if (redis) {
    const result = await redis.eval<string[], string>(
      CONSUME_TRANSACTION_SCRIPT,
      [transactionKey(validTransactionId)],
      [nonceHash]
    );

    if (!result.startsWith("error:")) {
      return result;
    }
    if (result === "error:not-ready") {
      throw new PwaAuthTransactionError("not-ready", "Sign-in is not ready yet.");
    }
    if (result === "error:invalid") {
      throw new PwaAuthTransactionError("invalid", "Invalid sign-in handoff.");
    }
    throw new PwaAuthTransactionError("missing", "This sign-in request has expired.");
  }

  const entry = readMemoryTransaction(validTransactionId);
  if (!entry) {
    throw new PwaAuthTransactionError("missing", "This sign-in request has expired.");
  }
  if (!nonceMatches(entry.record.nonceHash, validNonce)) {
    throw new PwaAuthTransactionError("invalid", "Invalid sign-in handoff.");
  }
  if (entry.record.status !== "ready" || !entry.record.userId) {
    throw new PwaAuthTransactionError("not-ready", "Sign-in is not ready yet.");
  }

  memoryTransactions.delete(validTransactionId);
  return entry.record.userId;
}
