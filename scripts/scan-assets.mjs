import {execFileSync, spawn, spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {basename, extname, isAbsolute, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const DEFAULT_INPUT = join(root, "public", "raw");
const OUTPUT_FILE = process.env.EM_OUTPUT_DIR
  ? join(process.env.EM_OUTPUT_DIR, "manifest.json")
  : join(root, "output", "manifest.json");
const THUMB_DIR = process.env.EM_OUTPUT_DIR
  ? join(process.env.EM_OUTPUT_DIR, "thumbnails")
  : join(root, "output", "thumbnails");

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm"]);
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
  // Keep CJK so Chinese asset names produce readable ids (e.g. 工程管家_Bedrock...).
  // Only whitespace / punctuation / runs of non-word chars collapse to a single "-".
  return relPath
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/[^\p{L}\p{N}._/-]+/gu, "-")
    .replace(/\/+/g, "__")
    .replace(/\./g, "_")
    .replace(/^[-_]+|[-_]+$/g, "");
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
 *
 * Performance: -an drops audio demux, scale=480:-1 downsamples before the
 * scene filter, and stderr is streamed line-by-line so long videos never
 * accumulate tens of MB of output in memory.
 */
function sceneCuts(file, threshold) {
  const child = spawn(
    "ffmpeg",
    ["-i", file, "-an", "-vf", `scale=480:-1,select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"],
    {windowsHide: true},
  );
  const pts = [];
  let errTail = "";
  return new Promise((resolve) => {
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      // Run the regex over (tail + text) so a pts_time number split across a
      // chunk boundary is still captured; keep only the trailing partial line.
      const window = errTail + text;
      const re = /pts_time:([0-9.]+)/g;
      let m;
      while ((m = re.exec(window)) !== null) {
        pts.push(parseFloat(m[1]));
      }
      errTail = window.slice(window.lastIndexOf("\n") + 1).slice(-256);
    });
    child.on("error", (err) => {
      console.warn(`  ! scene detection spawn failed for ${file}: ${err.message}`);
      resolve([]);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        console.warn(`  ! scene detection failed for ${file} (exit ${code}): ${errTail.split("\n").slice(-3).join(" ")}`);
        resolve([]);
        return;
      }
      resolve([...new Set(pts)].sort((a, b) => a - b));
    });
  });
}

/** Turn cut timestamps into contiguous segments covering [0, durationSec]. */
function makeSegments(cuts, durationSec) {
  if (!(durationSec > 0)) return [];
  // Merge cuts closer than MERGE_GAP: on real UI recordings scroll/popup
  // flicker produces sub-second clusters (measured: 27 of 57 cuts at 0.15
  // were <0.5s apart on a 69s clip). Treat a cluster as ONE scene change.
  const MERGE_GAP = 1.0;
  const merged = [];
  for (const c of cuts) {
    const last = merged[merged.length - 1];
    if (last && c - last < MERGE_GAP) merged[merged.length - 1] = c;
    else merged.push(c);
  }
  const segs = [];
  let prev = 0;
  for (const c of merged) {
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
    // Junction / symlink dirs (e.g. public/raw -> D:\EngineeringManager\promo\raw):
    // Dirent.isDirectory() is false for them on Windows, but they are real dirs.
    // Follow them via stat() so the junction subtree is scanned (and a broken
    // junction is reported instead of silently skipped).
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          out.push(...collectFiles(full));
          continue;
        }
      } catch (err) {
        console.warn(`  ! broken link/junction skipped: ${full} (${err.code})`);
        continue;
      }
    }
    if (entry.isFile() && SCAN_EXTS.has(extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

const publicDir = join(root, "public");

/**
 * Path strategy: ALL assets must live under <root>/public (e.g. the public/raw
 * junction -> D:\EngineeringManager\promo\raw). Only public-relative POSIX
 * paths are written to the manifest, because the renderer resolves every
 * asset via staticFile() against public/. A file outside public/ would render
 * as a 404 black frame, so we fail loudly instead of emitting a broken path.
 *
 * To add a new external source dir, create a junction once (admin-free):
 *   New-Item -ItemType Junction -Path "public\raw" -Target "D:\EngineeringManager\promo\raw"
 */
function assetPath(file) {
  const abs = resolve(file);
  const rel = relative(publicDir, abs);
  // Cross-drive relative() returns an absolute path (e.g. "D:\\..."), which
  // startsWith("..") would miss — catch both forms so a file outside public/
  // can never silently produce an unrenderable absolute path.
  const outside =
    rel === ".." ||
    rel.startsWith("..") ||
    rel.startsWith("..\\") ||
    isAbsolute(rel) ||
    /^[A-Za-z]:/.test(rel);
  if (outside) {
    console.error(`ERROR: asset outside public/ cannot be rendered: ${abs}`);
    console.error(`Create a junction so the renderer can reach it, e.g.:`);
    console.error(`  New-Item -ItemType Junction -Path "public\\raw" -Target "<source dir>"`);
    process.exit(1);
  }
  return rel.replace(/\\/g, "/");
}

async function inspectFile(file, inputDir, sceneThreshold, maxThumbnails) {
  const ext = extname(file).toLowerCase();
  const rel = relative(inputDir, file).replace(/\\/g, "/");
  let type;
  if (VIDEO_EXTS.has(ext)) type = "video";
  else if (IMAGE_EXTS.has(ext)) type = "image";
  else type = "html";

  // HTML has no ffprobe stream info; skip probing entirely.
  const info = type === "html" ? null : probe(file);
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
    const cuts = await sceneCuts(file, sceneThreshold);
    const segments = makeSegments(cuts, entry.durationSec);
    entry.segments = segments;
    entry.thumbnails = extractThumbnails(file, segments, id, maxThumbnails);
    console.log(`  ${id}: ${segments.length} segment(s), ${entry.thumbnails.length} thumbnail(s) @ scene>${sceneThreshold}`);
  }

  return entry;
}

async function main() {
  const {input, sceneThreshold, maxThumbnails} = parseArgs(process.argv);
  console.log("scan-assets: input =", input);

  if (!existsSync(input)) {
    console.error(`ERROR: input directory does not exist: ${input}`);
    process.exit(1);
  }

  const files = collectFiles(input);
  console.log(`scan-assets: found ${files.length} asset file(s)`);

  const manifest = [];
  for (const f of files) {
    manifest.push(await inspectFile(f, input, sceneThreshold, maxThumbnails));
  }
  manifest.sort((a, b) => a.id.localeCompare(b.id));

  writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`scan-assets: wrote ${manifest.length} entr(ies) to ${OUTPUT_FILE}`);
}

main().catch((err) => { console.error(err); process.exit(1); });















