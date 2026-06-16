const fs = require("fs");
const path = require("path");

const rootPublic = path.join(__dirname, "..", "..", "public", "downloads");
const desktopDist = path.join(__dirname, "..", "dist");

fs.mkdirSync(rootPublic, { recursive: true });

const target = process.argv[2];

if (target === "win") {
  const setup = fs
    .readdirSync(desktopDist)
    .find((file) => file.endsWith(".exe") && file.includes("Setup"));

  if (!setup) {
    console.error("Windows installer not found in desktop/dist");
    process.exit(1);
  }

  fs.copyFileSync(path.join(desktopDist, setup), path.join(rootPublic, "Nythera-Setup.exe"));
  console.log("Copied", setup, "to public/downloads/Nythera-Setup.exe");
}

if (target === "mac") {
  const dmg = fs.readdirSync(desktopDist).find((file) => file.endsWith(".dmg"));

  if (!dmg) {
    console.error("macOS dmg not found in desktop/dist");
    process.exit(1);
  }

  fs.copyFileSync(path.join(desktopDist, dmg), path.join(rootPublic, "Nythera.dmg"));
  console.log("Copied", dmg, "to public/downloads/Nythera.dmg");
}
