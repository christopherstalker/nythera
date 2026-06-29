const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

const SITE_URL = process.env.NYTHERA_SITE_URL || "https://nythera-ai-character-platform.vercel.app";
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
    if (!url.startsWith(SITE_URL)) {
      event.preventDefault();
      shell.openExternal(url);
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

app.whenReady().then(() => {
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
