import {spawnSync} from "node:child_process";
import {existsSync, mkdirSync} from "node:fs";
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

function parseArgs(argv) {
  const idx = argv.indexOf("--url");
  const url = idx !== -1 && argv[idx + 1] ? argv[idx + 1] : process.env.EM_APP_URL;
  const oIdx = argv.indexOf("--output");
  const outDir = oIdx !== -1 && argv[oIdx + 1] ? argv[oIdx + 1] : join(root, "output", "recordings");
  const dIdx = argv.indexOf("--duration");
  const duration = dIdx !== -1 && argv[dIdx + 1] ? parseInt(argv[dIdx + 1], 10) : 30;
  const headed = argv.includes("--headed");
  return {url, outDir, duration, headed};
}

async function main() {
  const {url, outDir, duration, headed} = parseArgs(process.argv);
  if (!url) {
    console.error("ERROR: no URL. Pass --url <url> or set EM_APP_URL.");
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

  console.log(`record-ui: recording ${url} for ${duration}s -> ${outDir}`);
  const browser = await chromium.launch({headless: !headed});
  const context = await browser.newContext({
    viewport: {width: 1920, height: 1080},
    recordVideo: {dir: outDir, size: {width: 1920, height: 1080}},
  });
  const page = await context.newPage();
  await page.goto(url, {waitUntil: "networkidle", timeout: 60000});
  await page.waitForTimeout(duration * 1000);

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
  const r = spawnSync("ffmpeg", ["-y", "-i", webmPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", mp4], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status === 0 && existsSync(mp4)) {
    console.log(`record-ui: converted to ${mp4}`);
  } else {
    console.warn("record-ui: ffmpeg conversion skipped/failed (webm kept)");
  }
}

main().catch((err) => {
  console.error("record-ui: FAILED", err);
  process.exit(1);
});
