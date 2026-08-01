import {execFileSync, spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readdirSync, writeFileSync} from "node:fs";
import {basename, extname, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const DEFAULT_INPUT = "D:\\EngineeringManager\\promo\\raw";
const OUTPUT_FILE = join(root, "content", "manifest.json");
const THUMB_DIR = join(root, "output", "thumbnails");

const VIDEO_EXTS = new Set([".mp4", ".mov"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg"]);
const HTML_EXTS = new Set([".html", ".htm"]);
const SCAN_EXTS = new Set([...VIDEO_EXTS, ...IMAGE_EXTS, ...HTML_EXTS]);

function parseArgs(argv) {
  let input = DEFAULT_INPUT;
  let sceneThreshold = 0.15;
  let maxThumbnails = 20;
  const idx = argv.indexOf("--input");
  if (idx !== -1 && argv[idx + 1]) input = argv[idx + 1];
  const tIdx = argv.indexOf("--scene-threshold");
  if (tIdx !== -1 && argv[tIdx + 1]) sceneThreshold = parseFloat(argv[tIdx + 1]);
  const mIdx = argv.indexOf("--max-thumbnails");
  if (mIdx !== -1 && argv[mIdx + 1]) maxThumbnails = parseInt(argv[mIdx + 1], 10);
  return {input, sceneThreshold, maxThumbnails};
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

const r3 = (x) => Math.round(x * 1000) / 1000;

/**
 * Scene-cut detection via ffmpeg's `select='gt(scene,THRESHOLD)',showinfo`.
 * Returns ascending cut timestamps (seconds). Empty array when no cuts found.
 * Read-only: never re-encodes or modifies the source file.
 */
function sceneCuts(file, threshold) {
  const r = spawnSync(
    "ffmpeg",
    ["-i", file, "-vf", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"],
    {encoding: "utf8", windowsHide: true},
  );
  if (r.status !== 0) {
    console.warn(`  ! scene detection failed for ${file}: ${(r.stderr || "").split("\n").slice(-3).join(" ")}`);
    return [];
  }
  const pts = [];
  const re = /pts_time:([0-9.]+)/g;
  let m;
  while ((m = re.exec(r.stderr || "")) !== null) {
    pts.push(parseFloat(m[1]));
  }
  return [...new Set(pts)].sort((a, b) => a - b);
}

/** Turn cut timestamps into contiguous segments covering [0, durationSec]. */
function makeSegments(cuts, durationSec) {
  if (!(durationSec > 0)) return [];
  const segs = [];
  let prev = 0;
  for (const c of cuts) {
    if (c > prev + 0.01) segs.push({start: r3(prev), end: r3(c)});
    prev = c;
  }
  if (durationSec > prev + 0.01) segs.push({start: r3(prev), end: r3(durationSec)});
  return segs;
}

/** Extract one thumbnail per segment midpoint (capped at maxCount) into output/thumbnails/. */
function extractThumbnails(file, segments, assetId, maxCount) {
  mkdirSync(THUMB_DIR, {recursive: true});
  const thumbs = [];
  const count = Math.min(segments.length, maxCount);
  for (let i = 0; i < count; i++) {
    const mid = (segments[i].start + segments[i].end) / 2;
    const out = join(THUMB_DIR, `${assetId}__${i}.jpg`);
    const r = spawnSync("ffmpeg", ["-ss", String(mid), "-i", file, "-vframes", "1", "-q:v", "3", "-y", out], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (r.status === 0 && existsSync(out)) {
      thumbs.push(`output/thumbnails/${assetId}__${i}.jpg`);
    } else {
      console.warn(`  ! thumbnail ${i} failed for ${file}`);
    }
  }
  return thumbs;
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

function inspectFile(file, inputDir, sceneThreshold, maxThumbnails) {
  const ext = extname(file).toLowerCase();
  const rel = relative(inputDir, file).replace(/\\/g, "/");
  let type;
  if (VIDEO_EXTS.has(ext)) type = "video";
  else if (IMAGE_EXTS.has(ext)) type = "image";
  else type = "html";

  const info = probe(file);
  const videoStream = info?.streams?.find((s) => s.codec_type === "video");
  const audioStream = info?.streams?.find((s) => s.codec_type === "audio");
  const id = slugify(rel);

  const entry = {
    id,
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

  if (type === "video") {
    const cuts = sceneCuts(file, sceneThreshold);
    const segments = makeSegments(cuts, entry.durationSec);
    entry.segments = segments;
    entry.thumbnails = extractThumbnails(file, segments, id, maxThumbnails);
    console.log(`  ${id}: ${segments.length} segment(s), ${entry.thumbnails.length} thumbnail(s) @ scene>${sceneThreshold}`);
  }

  return entry;
}

function main() {
  const {input, sceneThreshold, maxThumbnails} = parseArgs(process.argv);
  console.log("scan-assets: input =", input);

  if (!existsSync(input)) {
    console.error(`ERROR: input directory does not exist: ${input}`);
    process.exit(1);
  }

  const files = collectFiles(input);
  console.log(`scan-assets: found ${files.length} asset file(s)`);

  const manifest = files.map((f) => inspectFile(f, input, sceneThreshold, maxThumbnails)).sort((a, b) => a.id.localeCompare(b.id));

  writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`scan-assets: wrote ${manifest.length} entr(ies) to ${OUTPUT_FILE}`);
}

main();
