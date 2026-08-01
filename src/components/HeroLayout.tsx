import {Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame} from "remotion";
import {CANVAS, NO_TEXT_ZONE_FRACTION, SAFE_AREA} from "../design/tokens";
import type {Clip, ManifestEntry} from "../schemas/edl";

const CW = CANVAS.width;
const CH = CANVAS.height;

/** Hero layout: media as a framed "screen" over a gradient + grid background. */
export const HeroLayout: React.FC<{
  clip: Clip;
  asset: ManifestEntry;
}> = ({clip, asset}) => {
  const frame = useCurrentFrame();
  const layout = clip.layout;
  const mediaTop = layout?.mediaTop ?? 380;

  // Media dimensions: full canvas width, height from source aspect ratio.
  const aspect = asset.width && asset.height ? asset.width / asset.height : 16 / 9;
  const mediaH = Math.round(CW / aspect);
  const mediaBottom = mediaTop + mediaH;

  const isVideo = clip.type === "video";
  const src = resolveAssetSrc(asset.path);

  const mediaStyle: React.CSSProperties = {
    position: "absolute",
    top: mediaTop,
    left: 0,
    width: CW,
    height: mediaH,
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  };

  return (
    <div style={{position: "absolute", inset: 0, background: "linear-gradient(180deg, #14161A 0%, #0A0B0D 100%)"}}>
      {/* 48px grid overlay at 4% opacity */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />
      {/* Title above media */}
      {layout?.title ? (
        <div
          style={{
            position: "absolute",
            top: mediaTop - 64 - 88, // 64px gap + 88px font
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
            fontWeight: 700,
            fontSize: 88,
            lineHeight: 1.1,
            color: "#FFFFFF",
            textShadow: "0 4px 16px rgba(0,0,0,0.6)",
          }}
        >
          {layout.title}
        </div>
      ) : null}
      {/* Media */}
      <div style={mediaStyle}>
        {isVideo ? (
          <OffthreadVideo
            src={src}
            startFrom={Math.round((clip.sourceIn ?? 0) * 30)}
            endAt={clip.sourceOut !== undefined ? Math.round(clip.sourceOut * 30) : undefined}
            style={{width: "100%", height: "100%", objectFit: "cover"}}
          />
        ) : (
          <Img src={src} style={{width: "100%", height: "100%", objectFit: "cover"}} />
        )}
      </div>
    </div>
  );
};

function resolveAssetSrc(path: string): string {
  if (/^(https?:\/\/|file:\/\/|data:)/.test(path)) return path;
  if (/^[A-Za-z]:/.test(path)) {
    throw new Error(`resolveAssetSrc: absolute path "${path}" cannot be rendered via staticFile()`);
  }
  const rel = path.replace(/^public\//, "").replace(/\\/g, "/");
  return staticFile(rel);
}
