/**
 * Patches Remotion's copy-dir so directory symlinks (junctions) can be
 * reproduced on Windows during public/ bundling.
 *
 * Root cause (verified against source):
 *   node_modules/@remotion/bundler/dist/copy-dir.js line ~41:
 *     await fs.promises.symlink(realpath, destPath);
 *   On Windows, fs.symlink() without a `type` defaults to a FILE symlink,
 *   which requires administrator privileges for directory targets -> EPERM.
 *   Passing type="junction" creates a junction (no admin needed) — verified:
 *   fs.symlinkSync(target, link, "junction") succeeds as a normal user.
 *
 * This script is idempotent; safe to run on every install.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const target = join(root, "node_modules", "@remotion", "bundler", "dist", "copy-dir.js");

const MARKER = "// [em-promo-video patch]";
const original = readFileSync(target, "utf8");

if (original.includes(MARKER)) {
  console.log("patch-remotion: already patched, skipping");
  process.exit(0);
}

const needle = 'await node_fs_1.default.promises.symlink(realpath, destPath);';
const replacement =
  '// [em-promo-video patch] Windows directory junctions need type="junction" (no admin).\n' +
  'await node_fs_1.default.promises.symlink(realpath, destPath, process.platform === "win32" ? "junction" : undefined);';

if (!original.includes(needle)) {
  console.error("patch-remotion: needle not found in", target);
  process.exit(1);
}

writeFileSync(target, original.replace(needle, replacement), "utf8");
console.log("patch-remotion: patched", target);
