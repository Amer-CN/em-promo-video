import {interpolate, useCurrentFrame} from "remotion";
import {CANVAS, NO_TEXT_ZONE_FRACTION, SAFE_AREA} from "../design/tokens";

const FONT_FAMILY = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

/** Bottom safe area + NO_TEXT_ZONE_FRACTION of canvas height above it: no text may enter this zone. */
const NO_TEXT_ZONE = SAFE_AREA.bottom + CANVAS.height * NO_TEXT_ZONE_FRACTION;

const PUNCT = new Set(["，", "。", "！", "？", "、", "；", "："]);

/**
 * Group a subtitle sentence into chunks of 2-4 characters, one chunk shown at a time:
 * 1. hard-split at punctuation (，。！？、；：) first
 * 2. then cap at maxPerLine (4), but avoid splitting an obvious 2-char word
 * 3. fallback rule stays: never produce a 1-char group
 */
export function groupChars(text: string, maxPerLine = 4): string[] {
  const chars = Array.from(text);
  const groups: string[] = [];

  // Stage 1: split into segments at punctuation (kept at the end of its segment).
  let seg = "";
  for (const ch of chars) {
    seg += ch;
    if (PUNCT.has(ch)) {
      groups.push(seg);
      seg = "";
    }
  }
  if (seg.length > 0) groups.push(seg);

  // Stage 2: further split segments longer than maxPerLine.
  const split: string[] = [];
  for (const g of groups) {
    if (g.length <= maxPerLine) {
      split.push(g);
      continue;
    }
    const gchars = Array.from(g);
    let i = 0;
    while (i < gchars.length) {
      let take = Math.min(maxPerLine, gchars.length - i);
      // Avoid splitting a leading 2-char word: if taking 4 chars would end right
      // after a natural 2-char word and leave >= 1 char for the next group, take 2.
      const remaining = gchars.length - i - take;
      if (take === 4 && remaining >= 1 && isTwoCharWord(gchars, i, 2)) {
        take = 2;
      }
      split.push(gchars.slice(i, i + take).join(""));
      i += take;
    }
  }

  // Stage 3 (fallback): merge any trailing 1-char group so every group has >= 2 chars.
  const result = [...split];
  if (result.length > 1 && result[result.length - 1].length === 1) {
    const last = result.pop() as string;
    const prev = result[result.length - 1];
    result[result.length - 1] = prev + last;
  }
  return result;
}

/** Heuristic: chars[i..i+2) look like a 2-char word (CJK pair or common tech term). */
function isTwoCharWord(chars: string[], i: number, len: number): boolean {
  if (i + len > chars.length) return false;
  const word = chars.slice(i, i + len).join("");
  // CJK pairs are almost always words; also catch common ASCII tech terms.
  return /^[\u4e00-\u9fff]{2}$/.test(word) || /^(演示|功能|界面|系统|数据|录制|视频|画面|内容|流程)$/.test(word);
}

export const Subtitle: React.FC<{
  text: string;
  windowStartSec?: number;
  windowEndSec?: number;
  fontSize?: number;
}> = ({text, windowStartSec = 0, windowEndSec, fontSize = 64}) => {
  const frame = useCurrentFrame();
  const fps = CANVAS.fps;
  const groups = groupChars(text);
  if (groups.length === 0) return null;

  // Split the subtitle's window evenly across groups; each group is shown
  // alone (single line, centered), then swapped with a quick 3-frame fade-in.
  const windowEnd = windowEndSec ?? (text.length / 2) * 0.5 + 1;
  const dur = Math.max(0.01, windowEnd - windowStartSec);
  const t = frame / fps;
  const progress = Math.min(1, Math.max(0, (t - windowStartSec) / dur));
  const idx = Math.min(groups.length - 1, Math.floor(progress * groups.length));
  const group = groups[idx];

  // 3-frame quick fade-in at the start of each group; hard cut on the way out (no spring).
  // If the group is shorter than 3 frames, fade over the whole group so it reaches full opacity.
  const framesIntoWindow = Math.max(0, t - windowStartSec) * fps;
  const groupDurFrames = (dur * fps) / groups.length;
  const framesIntoGroup = framesIntoWindow % Math.max(1, groupDurFrames);
  const fadeInFrames = Math.min(3, Math.max(1, groupDurFrames));
  const fadeIn = interpolate(framesIntoGroup, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: NO_TEXT_ZONE,
        display: "flex",
        justifyContent: "center",
        padding: "0 96px",
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        fontSize,
        lineHeight: 1.25,
        color: "#FFFFFF",
        textShadow: "0 4px 12px rgba(0,0,0,0.85)",
        textAlign: "center",
        opacity: fadeIn,
        whiteSpace: "nowrap",
      }}
    >
      {group}
    </div>
  );
};



