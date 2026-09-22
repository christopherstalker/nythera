const ENDPOINTS = Object.freeze({ ollama: "http://127.0.0.1:11434/v1", lmstudio: "http://127.0.0.1:1234/v1" });

function localEndpoint(engine) {
  if (!Object.hasOwn(ENDPOINTS, engine)) throw new Error("Choose Ollama or LM Studio.");
  return ENDPOINTS[engine];
}

function validateGeneration(request) {
  localEndpoint(request?.engine);
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(request.requestId || "")) throw new Error("Invalid generation request.");
  if (typeof request.model !== "string" || !request.model.trim() || request.model.length > 120)
    throw new Error("Choose an installed model.");
  if (
    !Array.isArray(request.messages) ||
    !request.messages.length ||
    request.messages.length > 1000 ||
    request.messages.some(
      (message) => !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string"
    ) ||
    JSON.stringify(request.messages).length > 4000000
  )
    throw new Error("The local prompt is too large or invalid.");
  if (!Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 2)
    throw new Error("Invalid temperature.");
  if (
    request.maxTokens != null &&
    (!Number.isInteger(request.maxTokens) || request.maxTokens < 1 || request.maxTokens > 1048576)
  )
    throw new Error("Invalid output limit.");
  return {
    model: request.model,
    messages: request.messages,
    temperature: request.temperature,
    stream: true,
    ...(request.maxTokens == null ? {} : { max_tokens: request.maxTokens })
  };
}

async function readCompletion(body, onDelta, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let answer = "";
  let finished = false;
  const consume = (event) => {
    const content = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!content) return;
    if (content === "[DONE]") {
      finished = true;
      return;
    }
    const chunk = JSON.parse(content);
    if (chunk.error) throw new Error("The local model could not complete this reply.");
    const delta = chunk.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) {
      answer += delta;
      if (answer.length > 100000) throw new Error("The local reply exceeded the supported message size.");
      onDelta(delta);
    }
    if (chunk.choices?.[0]?.finish_reason) finished = true;
  };
  try {
    while (!finished) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      if (pending.length > 1000000) throw new Error("Invalid local model stream.");
      const events = pending.split(/\r?\n\r?\n/);
      pending = events.pop() || "";
      for (const event of events) consume(event);
      if (chunk.done) {
        if (pending.trim()) consume(pending);
        break;
      }
    }
    if (!finished) throw new Error("The local connection ended before the reply completed. Retry the message.");
    if (!answer.trim()) throw new Error("The local model returned no visible reply.");
    return answer;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function installLocalModelBridge(ipcMain, siteOrigin) {
  const running = new Map();
  const credentials = new Map();
  const tracked = new Set();
  const verifySender = (event) => {
    if (
      !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame ||
      new URL(event.senderFrame.url).origin !== siteOrigin
    )
      throw new Error("Untrusted local model request.");
    if (!tracked.has(event.sender.id)) {
      tracked.add(event.sender.id);
      const clear = () => {
        for (const [key, controller] of running)
          if (key.startsWith(`${event.sender.id}:`)) {
            controller.abort();
            running.delete(key);
          }
        for (const key of credentials.keys()) if (key.startsWith(`${event.sender.id}:`)) credentials.delete(key);
      };
      event.sender.on("did-start-navigation", (_navigation, _url, _inPlace, mainFrame) => {
        if (mainFrame) clear();
      });
      event.sender.once("destroyed", () => {
        clear();
        tracked.delete(event.sender.id);
      });
    }
  };
  ipcMain.handle("local-model:models", async (event, engine, token) => {
    verifySender(event);
    try {
      const endpoint = localEndpoint(engine);
      if (token !== undefined) {
        if (typeof token !== "string" || token.length > 1200 || /[\r\n]/.test(token))
          throw new Error("Invalid local access token.");
        if (token) credentials.set(`${event.sender.id}:${engine}`, token);
        else credentials.delete(`${event.sender.id}:${engine}`);
      }
      const savedToken = credentials.get(`${event.sender.id}:${engine}`);
      const response = await fetch(`${endpoint}/models`, {
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {}
      });
      if (!response.ok)
        return {
          ok: false,
          error:
            response.status === 401
              ? "This local server requires an access token."
              : "The local server could not list models."
        };
      const catalog = await response.text();
      if (catalog.length > 1000000) throw new Error("Local model catalog is too large.");
      const models = JSON.parse(catalog).data;
      if (!Array.isArray(models)) throw new Error("The local server returned an invalid model list.");
      return {
        ok: true,
        models: models
          .map((model) => model.id)
          .filter((id) => typeof id === "string" && id.length > 0 && id.length <= 120)
          .slice(0, 200)
      };
    } catch {
      return { ok: false, error: "Could not connect. Start the selected local server and try again." };
    }
  });
  ipcMain.handle("local-model:generate", async (event, request) => {
    verifySender(event);
    let key;
    let deadline;
    try {
      const payload = validateGeneration(request);
      if ([...running.keys()].some((entry) => entry.startsWith(`${event.sender.id}:`)))
        return { ok: false, error: "A local reply is already running. Stop it before starting another." };
      key = `${event.sender.id}:${request.requestId}`;
      const controller = new AbortController();
      running.set(key, controller);
      deadline = setTimeout(() => controller.abort(), 600000);
      const token = credentials.get(`${event.sender.id}:${request.engine}`);
      const response = await fetch(`${localEndpoint(request.engine)}/chat/completions`, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });
      if (!response.ok || !response.body)
        return {
          ok: false,
          error:
            response.status === 401
              ? "Reconnect the local server with its access token."
              : "The local server rejected this request. Check the model and its context window."
        };
      const text = await readCompletion(
        response.body,
        (text) => {
          if (!event.sender.isDestroyed())
            event.sender.send("local-model:delta", { requestId: request.requestId, text });
        },
        controller.signal
      );
      return { ok: true, text };
    } catch {
      return { ok: false, error: "Local generation stopped or the connection failed. Your message is kept for retry." };
    } finally {
      clearTimeout(deadline);
      if (key) running.delete(key);
    }
  });
  ipcMain.handle("local-model:cancel", (event, requestId) => {
    verifySender(event);
    running.get(`${event.sender.id}:${requestId}`)?.abort();
  });
}

module.exports = { localEndpoint, validateGeneration, readCompletion, installLocalModelBridge };
