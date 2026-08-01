import {Sequence, useCurrentFrame} from "remotion";
import edlRaw from "../../content/edl.json";
import manifestRaw from "../../content/manifest.json";
import {MediaClip} from "../components/MediaClip";
import {Subtitle} from "../components/Subtitle";
import {edlSchema, manifestEntrySchema, type Edl} from "../schemas/edl";

const FPS = 30;

const edl: Edl = edlSchema.parse(edlRaw);
const manifest = manifestEntrySchema.array().parse(manifestRaw);

const assetIndex: Map<string, (typeof manifest)[number]> = new Map(manifest.map((m) => [m.id, m]));

export const Promo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{width: "100%", height: "100%", backgroundColor: "#0E0E10"}}>
      {edl.clips.map((clip) => {
        const asset = assetIndex.get(clip.assetId);
        if (!asset) {
          console.warn(`Promo: asset "${clip.assetId}" missing from manifest, skipping clip "${clip.id}"`);
          return null;
        }
        return (
          <Sequence
            key={clip.id}
            from={Math.round(clip.timelineStart * FPS)}
            durationInFrames={Math.round(clip.duration * FPS)}
            name={clip.id}
          >
            <MediaClip clip={clip} asset={asset} />
            <ClipSubtitles clipId={clip.id} subtitles={clip.subtitles ?? []} />
          </Sequence>
        );
      })}
    </div>
  );
};

/** Renders the subtitle active at the current (clip-local) frame. */
const ClipSubtitles: React.FC<{clipId: string; subtitles: {text: string; start: number; end: number}[]}> = ({
  clipId,
  subtitles,
}) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const active = subtitles.find((s) => sec >= s.start && sec < s.end);
  if (!active) return null;
  return <Subtitle text={active.text} />;
};
