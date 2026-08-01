import {spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ---- SAFETY VALVE ---------------------------------------------------------
// Refuse to record unless EM_DEMO_MODE=1 is set. This protects real customer
// names / amounts from being captured into promo videos destined for social
// platforms. This is a hard red line: never bypass it.
if (process.env.EM_DEMO_MODE !== "1") {
  console.error("REFUSED: EM_DEMO_MODE must be set to '1' to record UI.");
  console.error("This is a data-masking safety valve: real customer data must never be captured into promo videos.");
  process.exit(1);
}

const DEFAULT_PAUSE_MS = 600; // breathing room between steps; the eye can't follow instant jumps

function parseArgs(argv) {
  const rIdx = argv.indexOf("--recording");
  const recording = rIdx !== -1 && argv[rIdx + 1] ? argv[rIdx + 1] : null;
  const oIdx = argv.indexOf("--output");
  const outDir = oIdx !== -1 && argv[oIdx + 1] ? argv[oIdx + 1] : join(root, "output", "recordings");
  const dIdx = argv.indexOf("--duration");
  const duration = dIdx !== -1 && argv[dIdx + 1] ? parseInt(argv[dIdx + 1], 10) : null;
  const headed = argv.includes("--headed");
  return {recording, outDir, duration, headed};
}

async function main() {
  const {recording, outDir, duration, headed} = parseArgs(process.argv);

  let url;
  let steps = [];
  let viewport = {width: 1920, height: 1080};
  let durationSec = duration;

  if (recording) {
    // Load a recording definition from content/recordings.json by id.
    const recFile = join(root, "content", "recordings.json");
    if (!existsSync(recFile)) {
      console.error(`ERROR: recordings file not found: ${recFile}`);
      process.exit(1);
    }
    let recs;
    try {
      recs = JSON.parse(readFileSync(recFile, "utf8"));
    } catch (err) {
      console.error(`ERROR: invalid JSON in ${recFile}: ${err.message}`);
      process.exit(1);
    }
    const found = recs.find((r) => r.id === recording);
    if (!found) {
      console.error(`ERROR: no recording definition with id "${recording}" in ${recFile}`);
      process.exit(1);
    }
    url = found.url;
    steps = found.steps ?? [];
    viewport = found.viewport ?? viewport;
    durationSec = duration ?? found.durationSec;
    console.log(`record-ui: definition "${found.id}" (${steps.length} step(s))`);
  } else {
    const uIdx = argv.indexOf("--url");
    url = uIdx !== -1 && argv[uIdx + 1] ? argv[uIdx + 1] : process.env.EM_APP_URL;
  }

  if (!url) {
    console.error("ERROR: no URL. Pass --url <url>, set EM_APP_URL, or use --recording <file>.");
    process.exit(1);
  }
  mkdirSync(outDir, {recursive: true});

  let chromium;
  try {
    ({chromium} = await import("playwright"));
  } catch {
    console.error("ERROR: playwright not installed. Run: npm install -D playwright && npx playwright install chromium");
    process.exit(1);
  }

  console.log(`record-ui: recording ${url} -> ${outDir}`);
  const browser = await chromium.launch({headless: !headed});
  const context = await browser.newContext({
    viewport,
    recordVideo: {dir: outDir, size: viewport},
  });
  const page = await context.newPage();
  await page.goto(url, {waitUntil: "networkidle", timeout: 60000});

  // Execute the step sequence with a default pause between actions.
  for (const [i, step] of steps.entries()) {
    const pauseMs = step.pauseMs ?? DEFAULT_PAUSE_MS;
    const label = step.describe ?? step.type;
    console.log(`  step ${i + 1}/${steps.length}: ${label}`);
    switch (step.type) {
      case "click":
        await page.click(step.selector);
        break;
      case "fill":
        await page.fill(step.selector, step.value ?? "");
        break;
      case "hover":
        await page.hover(step.selector);
        break;
      case "wait":
        await page.waitForTimeout(step.ms ?? 800);
        break;
      case "scroll":
        await page.mouse.wheel(0, step.deltaY ?? 400);
        break;
      default:
        console.warn(`  ! unknown step type "${step.type}", skipping`);
    }
    await page.waitForTimeout(pauseMs);
  }

  // Keep recording for a moment after steps so the final state is visible.
  if (durationSec) {
    await page.waitForTimeout(durationSec * 1000);
  }

  const video = page.video();
  await context.close(); // flushes the video file
  await browser.close();

  const webmPath = video ? await video.path() : null;
  if (!webmPath || !existsSync(webmPath)) {
    console.error("ERROR: no video recorded (page closed before frames were produced?)");
    process.exit(1);
  }
  console.log(`record-ui: recorded ${webmPath}`);

  // Convert webm -> mp4 with ffmpeg when available (promo pipeline consumes mp4).
  const mp4 = webmPath.replace(/\.webm$/i, ".mp4");
  const r = spawnSync("ffmpeg", ["-y", "-i", webmPath, "-vf", "fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", mp4], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status === 0 && existsSync(mp4)) {
    console.log(`record-ui: converted to ${mp4} (fps=30)`);
  } else {
    console.warn("record-ui: ffmpeg conversion skipped/failed (webm kept)");
  }
}

main().catch((err) => {
  console.error("record-ui: FAILED", err);
  process.exit(1);
});

