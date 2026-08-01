import {execFileSync} from "node:child_process";
import {existsSync, readdirSync, writeFileSync} from "node:fs";
import {basename, extname, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const DEFAULT_INPUT = "D:\\EngineeringManager\\promo\\raw";
const OUTPUT_FILE = join(root, "content", "manifest.json");

const VIDEO_EXTS = new Set([".mp4", ".mov"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg"]);
const HTML_EXTS = new Set([".html", ".htm"]);
const SCAN_EXTS = new Set([...VIDEO_EXTS, ...IMAGE_EXTS, ...HTML_EXTS]);

function parseArgs(argv) {
  let input = DEFAULT_INPUT;
  const idx = argv.indexOf("--input");
  if (idx !== -1 && argv[idx + 1]) {
    input = argv[idx + 1];
  }
  return {input};
}

function slugify(relPath) {
  return relPath
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/[^a-zA-Z0-9._/-]+/g, "-")
    .replace(/\/+/g, "__")
    .replace(/\./g, "_");
}

function probe(path) {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,duration", "-show_entries", "format=duration", "-of", "json", path],
      {encoding: "utf8", windowsHide: true},
    );
    return JSON.parse(out);
  } catch (err) {
    console.warn(`  ! ffprobe failed for ${path}: ${err.stderr?.trim() || err.message}`);
    return null;
  }
}

function parseFps(rFrameRate) {
  if (!rFrameRate) return null;
  const [num, den] = rFrameRate.split("/").map(Number);
  if (!num || !den) return null;
  return Math.round((num / den) * 1000) / 1000;
}

function collectFiles(dir) {
  const out = [];
  const entries = readdirSync(dir, {withFileTypes: true});
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
    } else if (SCAN_EXTS.has(extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}


const publicDir = join(root, "public");

/**
 * Path strategy:
 * - assets under <root>/public  → public-relative POSIX path (loadable via staticFile)
 * - everything else            → absolute POSIX path (renderer must map it, e.g. file://)
 */
function assetPath(file) {
  const abs = resolve(file);
  if (abs.startsWith(publicDir)) {
    return relative(publicDir, abs).replace(/\\/g, "/");
  }
  return abs.replace(/\\/g, "/");
}
function inspectFile(file, inputDir) {
  const ext = extname(file).toLowerCase();
  const rel = relative(inputDir, file).replace(/\\/g, "/");
  let type;
  if (VIDEO_EXTS.has(ext)) type = "video";
  else if (IMAGE_EXTS.has(ext)) type = "image";
  else type = "html";

  const info = probe(file);
  const videoStream = info?.streams?.find((s) => s.codec_type === "video");
  const audioStream = info?.streams?.find((s) => s.codec_type === "audio");

  return {
    id: slugify(rel),
    path: assetPath(file),
    type,
    durationSec:
      type === "video"
        ? Math.round((parseFloat(info?.format?.duration ?? videoStream?.duration) || 0) * 1000) / 1000
        : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    fps: type === "video" ? parseFps(videoStream?.r_frame_rate) : null,
    hasAudio: type === "video" ? Boolean(audioStream) : null,
  };
}

function main() {
  const {input} = parseArgs(process.argv);
  console.log("scan-assets: input =", input);

  if (!existsSync(input)) {
    console.error(`ERROR: input directory does not exist: ${input}`);
    process.exit(1);
  }

  const files = collectFiles(input);
  console.log(`scan-assets: found ${files.length} asset file(s)`);

  const manifest = files.map((f) => inspectFile(f, input)).sort((a, b) => a.id.localeCompare(b.id));

  writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`scan-assets: wrote ${manifest.length} entr(ies) to ${OUTPUT_FILE}`);
}

main();



