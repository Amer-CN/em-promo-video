/**
 * Node-side wrapper that resolves an EDL path into content props and invokes
 * `remotion render`. The browser bundle cannot read the filesystem
 * (calculateMetadata runs inside the renderer's browser page — see
 * node_modules/@remotion/renderer/dist/select-composition.js, which evaluates
 * window.remotion_calculateComposition via puppeteer), so the path must be
 * resolved here in node and the parsed content passed as props.
 *
 * Usage:
 *   node scripts/render-edl.mjs --edl content/edl.json --manifest output/manifest.json --output output/out.mp4
 *
 * Equivalents the reviewer asked for:
 *   npx remotion render src/index.ts Promo --props=<(content injected by this script)
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const edlPath = arg("--edl", "content/edl.json");
const manifestPath = arg("--manifest", "output/manifest.json");
const output = arg("--output", "output/out.mp4");
const extra = process.argv.filter((a) => a.startsWith("--") && !["--edl", "--manifest", "--output"].includes(a));

function readJson(p) {
  const full = join(root, p);
  if (!existsSync(full)) {
    console.error(`ERROR: file not found: ${p} (resolved ${full})`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(full, "utf8"));
  } catch (err) {
    console.error(`ERROR: invalid JSON in ${p}: ${err.message}`);
    process.exit(1);
  }
}

const edl = readJson(edlPath);
const manifest = readJson(manifestPath);

// Write a temp props file (the browser bundle receives parsed content, no fs access).
const propsFile = join(root, "tmp", "render-edl-props.json");
writeFileSync(propsFile, JSON.stringify({edl, manifest}), "utf8");

console.log(`render-edl: ${edlPath} + ${manifestPath} -> ${output}`);
const args = ["remotion", "render", "src/index.ts", "Promo", output, `--props=${propsFile}`, ...extra];
const r = spawnSync("npx", args, {stdio: "inherit", cwd: root, windowsHide: true, shell: true});
process.exit(r.status ?? 1);

