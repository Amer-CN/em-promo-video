import {useMemo} from "react";
import {Sequence, useCurrentFrame} from "remotion";
import {MediaClip} from "../components/MediaClip";
import {Subtitle} from "../components/Subtitle";
import type {Clip, Edl, ManifestEntry, Subtitle as SubtitleType} from "../schemas/edl";
import {CANVAS} from "../design/tokens";

const FPS = CANVAS.fps;

/**
 * Promo renders a full timeline from an in-memory EDL + manifest.
 * The browser bundle must NOT touch node:fs — content is injected via props
 * by calculateMetadata (which runs in the node process and resolves the
 * edlPath / manifestPath). The paths themselves only matter to
 * calculateMetadata, not to the component.
 */
export type PromoProps = {
  edlPath?: string;
  manifestPath?: string;
  edl?: Edl;
  manifest?: ManifestEntry[];
};

export const Promo: React.FC<PromoProps> = ({edl, manifest}) => {
  if (!edl || !manifest) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#0E0E10",
          color: "#FF0000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
        }}
      >
        Promo: missing edl/manifest content — calculateMetadata must inject them
      </div>
    );
  }
  const assetIndex: Map<string, ManifestEntry> = useMemo(
    () => new Map(manifest.map((m) => [m.id, m])),
    [manifest],
  );

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
            <ClipSubtitles clip={clip} subtitles={clip.subtitles ?? []} />
          </Sequence>
        );
      })}
    </div>
  );
};

/** Renders the subtitle active at the current (clip-local) frame, with its group window. */
const ClipSubtitles: React.FC<{clip: Clip; subtitles: SubtitleType[]}> = ({clip, subtitles}) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const active = subtitles.find((s) => sec >= s.start && sec < s.end);
  if (!active) return null;
  return <Subtitle text={active.text} windowStartSec={active.start} windowEndSec={active.end} />;
};


