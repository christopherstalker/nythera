export const LLM_PROVIDER_TIMEOUT_MS = 40_000;
export const LLM_FIRST_TOKEN_TIMEOUT_MS = 12_000;
export const LLM_STREAM_IDLE_TIMEOUT_MS = 20_000;
export const LLM_EMBEDDING_TIMEOUT_MS = 15_000;

export function createTimeoutSignal(parentSignal: AbortSignal | undefined, timeoutMs: number, timeoutMessage: string) {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromParent = () => {
    if (!controller.signal.aborted) {
      controller.abort(parentSignal?.reason ?? new Error("Request aborted."));
    }
  };

  const timeoutId = setTimeout(() => {
    timedOut = true;
    if (!controller.signal.aborted) {
      controller.abort(new Error(timeoutMessage));
    }
  }, timeoutMs);

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose() {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  };
}

export function createActivityTimeoutSignal(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
  timeoutMessage: string
) {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abortFromParent = () => {
    if (!controller.signal.aborted) {
      controller.abort(parentSignal?.reason ?? new Error("Request aborted."));
    }
  };

  const arm = (nextTimeoutMs: number, nextTimeoutMessage: string) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timedOut = true;
      if (!controller.signal.aborted) {
        controller.abort(new Error(nextTimeoutMessage));
      }
    }, nextTimeoutMs);
  };

  arm(timeoutMs, timeoutMessage);
  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    reset(nextTimeoutMs: number, nextTimeoutMessage: string) {
      if (!controller.signal.aborted) {
        arm(nextTimeoutMs, nextTimeoutMessage);
      }
    },
    dispose() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  };
}

export async function* abortableAsyncIterable<T>(source: AsyncIterable<T>, signal: AbortSignal): AsyncGenerator<T> {
  const iterator = source[Symbol.asyncIterator]();

  try {
    while (true) {
      const next = await nextWithAbort(iterator, signal);
      if (next.done) {
        return;
      }

      yield next.value;
    }
  } finally {
    await iterator.return?.();
  }
}

function nextWithAbort<T>(iterator: AsyncIterator<T>, signal: AbortSignal) {
  if (signal.aborted) {
    throw abortSignalError(signal);
  }

  return new Promise<IteratorResult<T>>((resolve, reject) => {
    const onAbort = () => {
      reject(abortSignalError(signal));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    iterator.next().then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

function abortSignalError(signal: AbortSignal) {
  if (signal.reason instanceof Error) {
    return signal.reason;
  }

  return new Error(typeof signal.reason === "string" ? signal.reason : "Request aborted.");
}
