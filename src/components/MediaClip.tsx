import {useRef} from "react";
import {IFrame, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame} from "remotion";
import type {Clip, KenBurns, ManifestEntry} from "../schemas/edl";

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

/**
 * Resolve an asset path from the manifest into a URL the renderer can load.
 * - http(s):// or file:// → used as-is
 * - public/... or bare name → resolved via staticFile() (public dir)
 * - anything else → treated as public-relative
 */
export function resolveAssetSrc(path: string): string {
  if (/^(https?:\/\/|file:\/\/|data:)/.test(path)) return path;
  const rel = path.replace(/^public\//, "").replace(/\\/g, "/");
  return staticFile(rel);
}

function applyFit(style: React.CSSProperties, fit: Clip["fit"]): React.CSSProperties {
  switch (fit) {
    case "contain":
      return {...style, objectFit: "contain"};
    case "cover":
    default:
      return {...style, objectFit: "cover"};
  }
}

function kenBurnsScale(kb: KenBurns | undefined, clipFrame: number, clipDurationSec: number): number {
  if (!kb) return 1;
  const progress = clipDurationSec > 0 ? clipFrame / (clipDurationSec * 30) : 0;
  return interpolate(progress, [0, 1], [kb.from, kb.to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

interface FocusGeometry {
  scale: number;
  translateX: number;
  translateY: number;
}

/**
 * For fit="focus": scale the source so the focusRect region fills the canvas,
 * centered on the focusRect center. Returns CSS transform values.
 */
function focusGeometry(focusRect: {x: number; y: number; w: number; h: number}, assetW: number, assetH: number): FocusGeometry {
  const scaleX = CANVAS_W / (assetW * focusRect.w);
  const scaleY = CANVAS_H / (assetH * focusRect.h);
  const scale = Math.max(scaleX, scaleY);
  const centerX = (focusRect.x + focusRect.w / 2) * assetW;
  const centerY = (focusRect.y + focusRect.h / 2) * assetH;
  const translateX = CANVAS_W / 2 - centerX * scale;
  const translateY = CANVAS_H / 2 - centerY * scale;
  return {scale, translateX, translateY};
}

function VideoLayer({clip, asset}: {clip: Clip; asset: ManifestEntry}) {
  const fps = 30;
  const startFrom = Math.round((clip.sourceIn ?? 0) * fps);
  const endAt = Math.round((clip.sourceOut ?? 0) * fps);
  const baseStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    position: "absolute",
    inset: 0,
  };
  return (
    <OffthreadVideo
      src={resolveAssetSrc(asset.path)}
      startFrom={startFrom}
      endAt={endAt}
      style={applyFit(baseStyle, clip.fit)}
    />
  );
}

function ImageLayer({clip, asset}: {clip: Clip; asset: ManifestEntry}) {
  const frame = useCurrentFrame();
  const kb = kenBurnsScale(clip.kenBurns, frame, clip.duration);
  const baseStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    position: "absolute",
    inset: 0,
  };

  if (clip.fit === "focus" && clip.focusRect) {
    const assetW = asset.width ?? CANVAS_W;
    const assetH = asset.height ?? CANVAS_H;
    const geo = focusGeometry(clip.focusRect, assetW, assetH);
    const transform = `translate(${geo.translateX}px, ${geo.translateY}px) scale(${geo.scale * kb})`;
    return (
      <div style={{position: "absolute", inset: 0, overflow: "hidden"}}>
        <img
          src={resolveAssetSrc(asset.path)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: assetW,
            height: assetH,
            transform,
            transformOrigin: "0 0",
          }}
        />
      </div>
    );
  }

  const style = {...baseStyle, transform: kb === 1 ? undefined : `scale(${kb})`};
  return <Img src={resolveAssetSrc(asset.path)} style={applyFit(style, clip.fit)} />;
}

function HtmlLayer({asset}: {asset: ManifestEntry}) {
  // The official <IFrame> component already wraps the iframe in delayRender()
  // and waits for its onLoad (Remotion source: packages/core/src/IFrame.tsx).
  // Adding our own delayRender here would double-hold the render, so we rely
  // on the built-in mechanism only.
  return (
    <IFrame
      src={resolveAssetSrc(asset.path)}
      style={{width: "100%", height: "100%", border: "none"}}
      delayRenderTimeoutInMilliseconds={30000}
    />
  );
}

export const MediaClip: React.FC<{clip: Clip; asset: ManifestEntry}> = ({clip, asset}) => {
  switch (clip.type) {
    case "video":
      return <VideoLayer clip={clip} asset={asset} />;
    case "image":
      return <ImageLayer clip={clip} asset={asset} />;
    case "html":
      return <HtmlLayer asset={asset} />;
    default:
      return null;
  }
};


