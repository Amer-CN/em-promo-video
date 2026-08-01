import {Composition, type CalculateMetadataFunction} from "remotion";
import {Promo, type PromoProps} from "./compositions/Promo";
import {CANVAS} from "./design/tokens";
import {edlSchema, manifestEntrySchema} from "./schemas/edl";
// Static imports resolve at bundle time (webpack inlines the JSON) — no
// node:fs involved, so this is safe in the browser bundle. These become the
// Studio-preview defaults; render-edl.mjs props override them at render time.
import edlJson from "../content/edl.json";
import manifestJson from "../output/manifest.json";

const defaultEdl = edlSchema.parse(edlJson);
const defaultManifest = manifestEntrySchema.array().parse(manifestJson);

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
      defaultProps={{edl: defaultEdl, manifest: defaultManifest}}
      calculateMetadata={calculateMetadata}
      durationInFrames={300}
      fps={CANVAS.fps}
      width={CANVAS.width}
      height={CANVAS.height}
    />
  );
};

