/**
 * Group a subtitle sentence into display chunks of 2-4 characters.
 *
 * Strategy (revised per review):
 * 1. hard-split at punctuation (，。！？、；：) — punctuation stays at the end
 *    of its segment
 * 2. split ASCII runs at whitespace/separators — each ASCII token (word or
 *    number) is kept WHOLE: latin glyphs are ~half the width of Han chars, so
 *    a long ASCII word is not visually oversized and must not be sliced
 * 3. chunk each CJK segment into <= maxPerLine (default 4), PREFERRING 3-4:
 *      remaining >= 6 -> take 4
 *      remaining == 5 -> take 3 (leaves 2, avoids a trailing 1-char orphan)
 *      remaining <= 4 -> take all
 *    Deterministic; avoids the "blind 2-char cut" of the previous heuristic.
 * 4. fallback: never leave a trailing 1-char group; merge it into the previous.
 */
export function groupChars(text: string, maxPerLine = 4): string[] {
  const chars = Array.from(text);
  if (chars.length === 0) return [];

  const PUNCT = new Set(["，", "。", "！", "？", "、", "；", "："]);
  const ASCII_WORD_BOUNDARY = /[\s,.;:!?()[\]{}<>"'/\\|@#$^&*+\-=~`]+/;
  const CJK = /[\u4e00-\u9fff]/;

  // Stage 1: punctuation hard-split (CJK punctuation stays at segment end).
  const segs: string[] = [];
  let seg = "";
  for (const ch of chars) {
    seg += ch;
    if (PUNCT.has(ch)) {
      segs.push(seg);
      seg = "";
    }
  }
  if (seg.length > 0) segs.push(seg);

  // Stage 2: further split ASCII runs at separators.
  const groups: string[] = [];
  for (const s of segs) {
    const parts = s.split(ASCII_WORD_BOUNDARY).filter(Boolean);
    if (parts.length > 1) {
      groups.push(...parts);
    } else {
      groups.push(s);
    }
  }

  // Stage 3: chunk CJK groups into <= maxPerLine (ASCII groups kept whole).
  const out: string[] = [];
  for (const g of groups) {
    const gchars = Array.from(g);
    const hasCjk = gchars.some((c) => CJK.test(c));
    if (!hasCjk || gchars.length <= maxPerLine) {
      out.push(g);
      continue;
    }
    let i = 0;
    while (i < gchars.length) {
      const remaining = gchars.length - i;
      let take: number;
      if (remaining === 5) take = 3; // leave 2, never a trailing 1
      else if (remaining <= maxPerLine) take = remaining; // 2..4
      else take = maxPerLine; // >= 6 -> 4
      out.push(gchars.slice(i, i + take).join(""));
      i += take;
    }
  }

  // Stage 4: merge a trailing 1-char group into the previous one.
  const result = [...out];
  if (result.length > 1 && Array.from(result[result.length - 1]).length === 1) {
    const last = result.pop() as string;
    result[result.length - 1] = result[result.length - 1] + last;
  }
  return result;
}
