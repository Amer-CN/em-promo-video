import {Composition, type CalculateMetadataFunction} from "remotion";
import {Promo, type PromoProps} from "./compositions/Promo";
import {CANVAS} from "./design/tokens";

/**
 * Content is injected via props (defaultProps provide the initial bundle-time
 * values; the CLI wrapper scripts/render-edl.mjs resolves an EDL path in node
 * and passes the parsed content). The browser bundle never touches node:fs —
 * calculateMetadata runs inside the renderer's browser page, so reading files
 * there is impossible by design.
 */
const calculateMetadata: CalculateMetadataFunction<PromoProps> = async ({props}) => {
  if (!props.edl) {
    throw new Error(
      "Promo: missing edl content in props. Use scripts/render-edl.mjs --edl <path> or pass edl content via --props.",
    );
  }
  const totalSec = Math.max(...props.edl.clips.map((c) => c.timelineStart + c.duration));
  return {
    durationInFrames: Math.max(1, Math.round(totalSec * CANVAS.fps)),
    fps: CANVAS.fps,
    width: CANVAS.width,
    height: CANVAS.height,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Promo"
      component={Promo}
      defaultProps={{edlPath: "content/edl.json", manifestPath: "content/manifest.json"}}
      calculateMetadata={calculateMetadata}
      durationInFrames={300}
      fps={CANVAS.fps}
      width={CANVAS.width}
      height={CANVAS.height}
    />
  );
};
