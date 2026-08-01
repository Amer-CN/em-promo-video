import {interpolate, useCurrentFrame} from "remotion";
import {CANVAS, NO_TEXT_ZONE_FRACTION, SAFE_AREA} from "../design/tokens";
import {groupChars} from "../utils/groupChars";

const FONT_FAMILY = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

/** Bottom safe area + NO_TEXT_ZONE_FRACTION of canvas height above it: no text may enter this zone. */
const NO_TEXT_ZONE = SAFE_AREA.bottom + CANVAS.height * NO_TEXT_ZONE_FRACTION;



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

