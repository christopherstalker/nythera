const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");
const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { installLocalModelBridge } = require("../../desktop/electron/local-model.cjs");

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const modelServer = createServer(async (request, response) => {
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "fixture-local-model" }] }));
      return;
    }
    assert.equal(request.url, "/v1/chat/completions");
    let content = "";
    for await (const chunk of request) content += chunk;
    const payload = JSON.parse(content);
    assert.equal(payload.model, "fixture-local-model");
    assert.equal(Object.hasOwn(payload, "max_tokens"), false);
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write('data: {"choices":[{"delta":{"content":"Hello 🌙"}}]}\n\n');
    if (payload.messages[0].content === "cancel") return;
    response.end("data: [DONE]\n\n");
  });
  const site = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(
      "<!doctype html><html><head><title>Local bridge fixture</title></head><body>Local bridge fixture</body></html>"
    );
  });
  let window;
  try {
    modelServer.listen(11434, "127.0.0.1");
    await once(modelServer, "listening");
    site.listen(0, "127.0.0.1");
    await once(site, "listening");
    const origin = `http://127.0.0.1:${site.address().port}`;
    installLocalModelBridge(ipcMain, origin);
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve("desktop/electron/preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    await window.loadURL(origin);
    const verification = await window.webContents.executeJavaScript(`(async () => {
      const bridge = window.nytheraDesktop.local;
      const models = await bridge.models("ollama");
      const chunks = [];
      const off = bridge.onDelta((chunk) => chunks.push(chunk.text));
      const reply = await bridge.generate({ requestId: "fixture-success", engine: "ollama", model: "fixture-local-model", messages: [{ role: "user", content: "hello" }], temperature: 0.7, maxTokens: null });
      off();
      const stop = bridge.onDelta(() => bridge.cancel("fixture-cancel"));
      const cancelled = await bridge.generate({ requestId: "fixture-cancel", engine: "ollama", model: "fixture-local-model", messages: [{ role: "user", content: "cancel" }], temperature: 0.7 });
      stop();
      return { models, reply, chunks, cancelled, isolated: typeof require === "undefined" };
    })()`);
    assert.equal(verification.models.ok, true);
    assert.deepEqual(verification.models.models, ["fixture-local-model"]);
    assert.equal(verification.reply.text, "Hello 🌙");
    assert.deepEqual(verification.chunks, ["Hello 🌙"]);
    assert.equal(verification.cancelled.ok, false);
    assert.equal(verification.isolated, true);
    console.log("Desktop IPC smoke passed: sandboxed preload, discovery, local SSE, Unicode and cancellation.");
    app.exit(0);
  } catch (error) {
    console.error(error.message);
    app.exit(1);
  } finally {
    window?.destroy();
    modelServer.closeAllConnections();
    modelServer.close();
    site.closeAllConnections();
    site.close();
  }
});
