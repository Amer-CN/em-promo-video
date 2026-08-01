import {Composition} from "remotion";
import edl from "../content/edl.json";
import {Promo} from "./compositions/Promo";
import {CANVAS} from "./design/tokens";

const FPS = edl.meta.fps;
const totalSec = Math.max(...edl.clips.map((c) => c.timelineStart + c.duration));
const durationInFrames = Math.max(1, Math.round(totalSec * FPS));

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={durationInFrames}
      fps={CANVAS.fps}
      width={CANVAS.width}
      height={CANVAS.height}
    />
  );
};
