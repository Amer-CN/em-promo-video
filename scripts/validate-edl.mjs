import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function resolveArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const EDL_FILE = resolveArg("--edl", join(root, "content", "edl.json"));
const MANIFEST_FILE = resolveArg("--manifest", join(root, "content", "manifest.json"));
const EPS = 1e-6;

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function readJson(path, label) {
  if (!existsSync(path)) {
    fail(`missing ${label}: ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(`invalid JSON in ${label} (${path}): ${err.message}`);
    return null;
  }
}

function isNonNegativeNumber(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function main() {
  const edl = readJson(EDL_FILE, "EDL");
  const manifest = readJson(MANIFEST_FILE, "manifest");
  if (!edl) process.exit(1);

  // ---- structural checks (mirror of content/edl.schema.json) ----
  if (!edl.meta || typeof edl.meta !== "object") fail("meta is required");
  else {
    if (edl.meta.width !== 1080) fail(`meta.width must be 1080, got ${edl.meta.width}`);
    if (edl.meta.height !== 1920) fail(`meta.height must be 1920, got ${edl.meta.height}`);
    if (edl.meta.fps !== 30) fail(`meta.fps must be 30, got ${edl.meta.fps}`);
    if (!edl.meta.title || typeof edl.meta.title !== "string") fail("meta.title must be a non-empty string");
  }
  if (!Array.isArray(edl.clips) || edl.clips.length === 0) fail("clips must be a non-empty array");

  const clips = Array.isArray(edl.clips) ? edl.clips : [];
  const ids = new Set();
  const assetIds = new Set(manifest?.map?.((m) => m.id) ?? []);

  for (const [i, clip] of clips.entries()) {
    const where = `clips[${i}]`;
    if (!clip || typeof clip !== "object") {
      fail(`${where}: not an object`);
      continue;
    }
    if (!clip.id || typeof clip.id !== "string") fail(`${where}: id is required`);
    else if (ids.has(clip.id)) fail(`${where}: duplicate clip id "${clip.id}"`);
    else ids.add(clip.id);

    if (typeof clip.assetId !== "string" || !clip.assetId) fail(`${where}: assetId is required`);

    const validTypes = ["video", "image", "html"];
    if (!validTypes.includes(clip.type)) fail(`${where}: type must be one of ${validTypes.join("/")}`);

    if (!isNonNegativeNumber(clip.timelineStart)) fail(`${where}: timelineStart must be a non-negative number`);
    if (typeof clip.duration !== "number" || !(clip.duration > 0)) fail(`${where}: duration must be a positive number`);

    const fits = ["cover", "contain", "focus"];
    if (!fits.includes(clip.fit)) fail(`${where}: fit must be one of ${fits.join("/")}`);

    if (clip.type === "video") {
      if (!isNonNegativeNumber(clip.sourceIn)) fail(`${where}: sourceIn is required for video`);
      if (typeof clip.sourceOut !== "number" || !(clip.sourceOut > (clip.sourceIn ?? -1))) {
        fail(`${where}: sourceOut must be a number greater than sourceIn`);
      }
    } else {
      if (clip.sourceIn !== undefined || clip.sourceOut !== undefined) {
        warn(`${where}: sourceIn/sourceOut present but type is ${clip.type} (ignored)`);
      }
    }

    if (clip.fit === "focus") {
      if (!clip.focusRect) fail(`${where}: focusRect is required when fit=focus`);
      else {
        const {x, y, w, h} = clip.focusRect;
        for (const [k, v] of Object.entries({x, y, w, h})) {
          if (typeof v !== "number" || !(v >= 0 && v <= 1)) fail(`${where}: focusRect.${k} must be in [0,1]`);
        }
        if (!(w > 0 && h > 0)) fail(`${where}: focusRect.w and focusRect.h must be > 0`);
        if (clip.focusRect.focusFit !== undefined && !["cover", "contain"].includes(clip.focusRect.focusFit)) {
          fail(`${where}: focusRect.focusFit must be "cover" or "contain"`);
        }

      }
    }

    // C-1: content-area ratio — how much of the canvas is covered by media.
    // Hard gate: < 0.55 with no layout declaration -> FAILED (catches letterboxed
    // shots that are too small to be readable; C-2 layout overrides this).
    const asset = manifest.find((m) => m.id === clip.assetId);
    const aw = asset?.width ?? 1;
    const ah = asset?.height ?? 1;
    const CW = 1080;
    const CH = 1920;
    let ratio = 1;
    if (clip.fit === "focus" && clip.focusRect) {
      const {w, h} = clip.focusRect;
      const fw = aw * w;
      const fh = ah * h;
      const scaleX = CW / fw;
      const scaleY = CH / fh;
      const mode = clip.focusRect.focusFit ?? "cover";
      const scale = mode === "contain" ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
      ratio = Math.min(1, (fw * scale) / CW) * Math.min(1, (fh * scale) / CH);
    }
    const ratioPct = Math.round(ratio * 100);
    console.log(`  ${where}: contentAreaRatio=${ratioPct}% (fit=${clip.fit}${clip.focusRect ? `/${clip.focusRect.focusFit ?? "cover"}` : ""})`);
    // C-3: warn when cover focusRect is too wide (low utilization after zoom).
    if (clip.fit === "focus" && clip.focusRect) {
      const focusFit = clip.focusRect.focusFit ?? "cover";
      if (focusFit === "cover") {
        const aspect = (clip.focusRect.w * aw) / (clip.focusRect.h * ah);
        if (aspect > 1.2) {
          warn(`${where}: focusRect aspect ratio ${aspect.toFixed(2)} > 1.2 — region is wide/flat; zooming will crop heavily. Consider a taller region (w 0.22-0.35, h 0.75-1.0) for vertical promo.`);
        }
      }
    }
    if (ratio < 0.55 && !clip.layout) {
      fail(`${where}: contentAreaRatio ${ratioPct}% < 55% — media covers too little of the canvas. Use a larger focusRect, fit=cover, or declare a layout (C-2) that accounts for the empty space.`);
    }

    if (clip.kenBurns !== undefined) {
      if (typeof clip.kenBurns.from !== "number" || !(clip.kenBurns.from >= 1)) fail(`${where}.kenBurns.from must be a number >= 1 (render path does not run zod)`);
      if (typeof clip.kenBurns.to !== "number" || !(clip.kenBurns.to >= 1)) fail(`${where}.kenBurns.to must be a number >= 1 (render path does not run zod)`);
      // kenBurns only applies to focus; cover/contain video ignores it silently.
      if (clip.fit !== "focus") warn(`${where}: kenBurns has no effect when fit=${clip.fit} (only focus applies it)`);
    }

    if (clip.subtitles !== undefined) {
      if (!Array.isArray(clip.subtitles)) fail(`${where}: subtitles must be an array`);
      else {
        for (const [j, sub] of clip.subtitles.entries()) {
          if (!sub || typeof sub.text !== "string" || !sub.text) fail(`${where}.subtitles[${j}]: text is required`);
          if (!isNonNegativeNumber(sub.start)) fail(`${where}.subtitles[${j}]: start must be a non-negative number`);
          if (typeof sub.end !== "number" || !(sub.end > sub.start)) fail(`${where}.subtitles[${j}]: end must be greater than start`);
          if (!(sub.end <= clip.duration + EPS)) fail(`${where}.subtitles[${j}]: end (${sub.end}) exceeds clip duration (${clip.duration})`);
        }
        // Overlap check: ClipSubtitles uses .find() which only shows the FIRST
        // subtitle active at a frame — an overlapping later one is silently
        // swallowed, so overlapping windows must be rejected.
        const sorted = [...clip.subtitles].sort((a, b) => a.start - b.start);
        for (let j = 1; j < sorted.length; j++) {
          if (sorted[j].start < sorted[j - 1].end - EPS) {
            fail(
              `${where}: subtitles[${j}] start (${sorted[j].start}) overlaps previous end (${sorted[j - 1].end}) — ` +
                `windows must not overlap (ClipSubtitles only shows the first match)`,
            );
          }
        }
      }
    }
  }

  // ---- timeline continuity: no overlap, no gaps ----
  const sorted = [...clips]
    .filter((c) => isNonNegativeNumber(c.timelineStart) && typeof c.duration === "number")
    .sort((a, b) => a.timelineStart - b.timelineStart);

  if (sorted.length > 0) {
    if (Math.abs(sorted[0].timelineStart) > EPS) {
      fail(`timeline gap: first clip starts at ${sorted[0].timelineStart}s, expected 0`);
    }
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const aEnd = a.timelineStart + a.duration;
      if (b.timelineStart < aEnd - EPS) {
        fail(`timeline overlap: clip "${b.id}" starts at ${b.timelineStart}s but previous "${a.id}" ends at ${aEnd}s`);
      } else if (b.timelineStart > aEnd + EPS) {
        fail(`timeline gap: ${b.timelineStart - aEnd}s gap between clip "${a.id}" (ends ${aEnd}s) and clip "${b.id}" (starts ${b.timelineStart}s)`);
      }
    }
  }

  // ---- voiceover coverage: timeline duration must cover the declared voiceover ----
  const voSec = edl.meta?.voiceoverDurationSec;
  if (typeof voSec === "number" && voSec > 0) {
    const timelineEnd = sorted.length > 0 ? sorted[sorted.length - 1].timelineStart + sorted[sorted.length - 1].duration : 0;
    if (timelineEnd < voSec - EPS) {
      fail(`voiceoverDurationSec (${voSec}s) exceeds timeline duration (${timelineEnd}s)`);
    } else {
      console.log(`validate-edl: voiceover ${voSec}s covered by timeline ${timelineEnd}s`);
    }
  }

  // ---- source bounds vs manifest ----
  if (manifest) {
    for (const clip of clips) {
      if (clip.type !== "video") continue;
      const asset = manifest.find((m) => m.id === clip.assetId);
      if (!asset) {
        warn(`clip "${clip.id}" references assetId "${clip.assetId}" not found in manifest`);
        continue;
      }
      const assetDur = asset.durationSec ?? 0;
      if (clip.sourceIn > assetDur + EPS) {
        fail(`clip "${clip.id}": sourceIn (${clip.sourceIn}s) exceeds asset "${asset.id}" duration (${assetDur}s)`);
      }
      if (clip.sourceOut > assetDur + EPS) {
        fail(`clip "${clip.id}": sourceOut (${clip.sourceOut}s) exceeds asset "${asset.id}" duration (${assetDur}s)`);
      }
      if (clip.duration > (clip.sourceOut - clip.sourceIn) + EPS) {
        fail(`clip "${clip.id}": duration (${clip.duration}s) exceeds source window (${clip.sourceOut - clip.sourceIn}s)`);
      }
    }
  } else {
    warn("manifest.json missing — source bounds vs asset duration not verified");
  }

  // ---- asset type consistency ----
  if (manifest) {
    for (const clip of clips) {
      const asset = manifest.find((m) => m.id === clip.assetId);
      if (asset && asset.type !== clip.type) {
        fail(`clip "${clip.id}" type "${clip.type}" mismatches asset "${asset.id}" type "${asset.type}"`);
      }
    }
  }

  for (const w of warnings) console.warn(`WARN: ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    console.error(`validate-edl: FAILED (${errors.length} error(s), ${warnings.length} warning(s))`);
    process.exit(1);
  }
  console.log(`validate-edl: OK (${clips.length} clip(s), ${warnings.length} warning(s))`);
}

main();












