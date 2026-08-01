import {SAFE_AREA} from "../design/tokens";
import {CANVAS_H} from "./MediaClip";

const FONT_FAMILY = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

/** Bottom safe area + 15% of canvas height above it: no text may enter this zone. */
const NO_TEXT_ZONE = SAFE_AREA.bottom + CANVAS_H * 0.15;

/**
 * Group a subtitle line into chunks of 2-4 characters.
 * Prefers 4 per line; a trailing single char is merged into the previous line.
 */
export function groupChars(text: string, maxPerLine = 4): string[] {
  const chars = Array.from(text);
  const groups: string[] = [];
  let i = 0;
  while (i < chars.length) {
    const take = Math.min(maxPerLine, chars.length - i);
    groups.push(chars.slice(i, i + take).join(""));
    i += take;
  }
  // Merge a trailing 1-char group into the previous one so every group has >= 2 chars.
  if (groups.length > 1 && groups[groups.length - 1].length === 1) {
    const last = groups.pop() as string;
    const prev = groups[groups.length - 1];
    groups[groups.length - 1] = prev + last;
  }
  return groups;
}

export const Subtitle: React.FC<{text: string; fontSize?: number}> = ({text, fontSize = 64}) => {
  const lines = groupChars(text);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: NO_TEXT_ZONE,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "0 96px",
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        fontSize,
        lineHeight: 1.25,
        color: "#FFFFFF",
        textShadow: "0 4px 12px rgba(0,0,0,0.85)",
        textAlign: "center",
      }}
    >
      {lines.map((line, idx) => (
        <span key={idx}>{line}</span>
      ))}
    </div>
  );
};
