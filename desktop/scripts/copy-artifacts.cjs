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
  const portable = fs
    .readdirSync(desktopDist)
    .find((file) => file.endsWith(".exe") && file.includes("Portable"));

  if (!setup) {
    console.error("Windows installer not found in desktop/dist");
    process.exit(1);
  }

  fs.copyFileSync(path.join(desktopDist, setup), path.join(rootPublic, "Nythera-Setup.exe"));
  console.log("Copied", setup, "to public/downloads/Nythera-Setup.exe");

  if (portable) {
    fs.copyFileSync(path.join(desktopDist, portable), path.join(rootPublic, "Nythera-Portable.exe"));
    console.log("Copied", portable, "to public/downloads/Nythera-Portable.exe");
  }
}
