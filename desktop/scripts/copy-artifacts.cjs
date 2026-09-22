const fs = require("fs");
const path = require("path");
const { version } = require("../package.json");

const rootPublic = path.join(__dirname, "..", "..", "public", "downloads");
const desktopDist = path.join(__dirname, "..", "dist");

fs.mkdirSync(rootPublic, { recursive: true });

const target = process.argv[2];

if (target === "win") {
  const setup = `Nythera-Setup-${version}.exe`;
  const portable = `Nythera-Portable-${version}.exe`;

  if (!fs.existsSync(path.join(desktopDist, setup)) || !fs.existsSync(path.join(desktopDist, portable))) {
    console.error(`Windows release ${version} is incomplete in desktop/dist`);
    process.exit(1);
  }

  fs.copyFileSync(path.join(desktopDist, setup), path.join(rootPublic, "Nythera-Setup.exe"));
  console.log("Copied", setup, "to public/downloads/Nythera-Setup.exe");

  fs.copyFileSync(path.join(desktopDist, portable), path.join(rootPublic, "Nythera-Portable.exe"));
  console.log("Copied", portable, "to public/downloads/Nythera-Portable.exe");
}
