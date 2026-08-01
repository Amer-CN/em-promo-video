import {execSync} from "node:child_process";
import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function check(cmd) {
  try {
    const out = execSync(cmd, {encoding: "utf8", stdio: ["pipe", "pipe", "pipe"]}).trim();
    return out.split("\n")[0];
  } catch {
    return null;
  }
}

const nodeVer = check("node --version");
const npmVer = check("npm --version");
const ffmpegVer = check("ffmpeg -version");
const ffprobeVer = check("ffprobe -version");

console.log("=== em-promo-video doctor ===");
console.log("Node:    ", nodeVer ?? "MISSING");
console.log("npm:     ", npmVer ?? "MISSING");
console.log("FFmpeg:  ", ffmpegVer ?? "MISSING");
console.log("ffprobe: ", ffprobeVer ?? "MISSING");

const requiredDirs = ["src", "src/components", "src/compositions", "src/design", "src/schemas", "src/utils", "content", "scripts", "output"];
const missingDirs = requiredDirs.filter((d) => !existsSync(join(root, d)));
if (missingDirs.length > 0) {
  console.log("Missing directories:", missingDirs.join(", "));
  process.exit(1);
}

const requiredFiles = ["package.json", "tsconfig.json", "remotion.config.ts", "src/index.ts", "src/Root.tsx", "content/edl.schema.json", "scripts/validate-edl.mjs"];
const missingFiles = requiredFiles.filter((f) => !existsSync(join(root, f)));
if (missingFiles.length > 0) {
  console.log("Missing files:", missingFiles.join(", "));
  process.exit(1);
}

if (!nodeVer || !ffmpegVer || !ffprobeVer) {
  console.log("FAIL: required tooling missing");
  process.exit(1);
}

console.log("OK: all checks passed");

