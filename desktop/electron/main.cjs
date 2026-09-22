const { app, BrowserWindow, Menu, session, shell, ipcMain } = require("electron");
const { installLocalModelBridge } = require("./local-model.cjs");
const path = require("path");

const SITE_URL = process.env.NYTHERA_SITE_URL || "https://www.nythera.art";
const SITE_ORIGIN = new URL(SITE_URL).origin;
const isMac = process.platform === "darwin";

function createWindow() {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 390,
    minHeight: 620,
    show: false,
    title: "Nythera",
    backgroundColor: "#0B0B12",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== SITE_ORIGIN) {
      event.preventDefault();
      if (["http:", "https:"].includes(new URL(url).protocol)) shell.openExternal(url);
    }
  });

  window.loadURL(SITE_URL);

  return window;
}

function buildMenu(mainWindow) {
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }]
          }
        ]
      : []),
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Navigate",
      submenu: [
        {
          label: "Home",
          click: () => mainWindow.loadURL(SITE_URL)
        },
        {
          label: "Explore",
          click: () => mainWindow.loadURL(`${SITE_URL}/explore`)
        },
        {
          label: "Back",
          click: () => {
            if (mainWindow.webContents.canGoBack()) {
              mainWindow.webContents.goBack();
            }
          }
        }
      ]
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function configurePermissions() {
  const isTrustedOrigin = (url) => {
    try {
      return new URL(url).origin === SITE_ORIGIN;
    } catch {
      return false;
    }
  };
  const isAudioRequest = (permission, mediaTypes = []) => permission === "media" && mediaTypes.includes("audio");

  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) =>
      isTrustedOrigin(requestingOrigin || webContents?.getURL() || "") &&
      isAudioRequest(permission, details?.mediaTypes)
  );
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(isTrustedOrigin(webContents.getURL()) && isAudioRequest(permission, details?.mediaTypes));
  });
}

app.whenReady().then(() => {
  installLocalModelBridge(ipcMain, SITE_ORIGIN);
  configurePermissions();
  const mainWindow = createWindow();
  buildMenu(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});
