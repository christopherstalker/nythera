const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nytheraDesktop", {
  platform: process.platform,
  version: "1.1.0",
  local: {
    models: (engine, token) => ipcRenderer.invoke("local-model:models", engine, token),
    generate: (request) => ipcRenderer.invoke("local-model:generate", request),
    cancel: (requestId) => ipcRenderer.invoke("local-model:cancel", requestId),
    onDelta: (callback) => {
      const listener = (_event, chunk) => callback(chunk);
      ipcRenderer.on("local-model:delta", listener);
      return () => ipcRenderer.removeListener("local-model:delta", listener);
    }
  }
});
