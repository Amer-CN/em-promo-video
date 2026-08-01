import {cloneElement, isValidElement} from "react";
import {IFrame, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame} from "remotion";
import type {Clip, KenBurns, ManifestEntry} from "../schemas/edl";
import {CANVAS} from "../design/tokens";

export const CANVAS_W = CANVAS.width;
export const CANVAS_H = CANVAS.height;

/**
 * Resolve an asset path from the manifest into a URL the renderer can load.
 * - http(s):// or file:// → used as-is
 * - public/... or bare name → resolved via staticFile() (public dir)
 * - anything else → treated as public-relative
 */
export function resolveAssetSrc(path: string): string {
  if (/^(https?:\/\/|file:\/\/|data:)/.test(path)) return path;
  // Drive-letter absolute paths cannot be served by staticFile() — they would
  // silently 404 into a black frame. Fail loudly instead.
  if (/^[A-Za-z]:/.test(path)) {
    throw new Error(
      `resolveAssetSrc: absolute path "${path}" cannot be rendered via staticFile(). ` +
        `Assets must live under public/ (e.g. the public/raw junction). ` +
        `Run scan-assets again after creating the junction.`,
    );
  }
  const rel = path.replace(/^public\//, "").replace(/\\/g, "/");
  return staticFile(rel);
}

/**
 * fit semantics:
 * - cover / contain → CSS object-fit on the media element
 * - focus → no object-fit; the media is scaled/translated by focusGeometry()
 *   inside an overflow-hidden container. NEVER falls through to cover.
 */
function applyFit(style: React.CSSProperties, fit: Clip["fit"]): React.CSSProperties {
  switch (fit) {
    case "contain":
      return {...style, objectFit: "contain"};
    case "focus":
      return style; // handled by FocusLayer
    case "cover":
    default:
      return {...style, objectFit: "cover"};
  }
}

function kenBurnsScale(kb: KenBurns | undefined, clipFrame: number, clipDurationSec: number, fps: number): number {
  if (!kb) return 1;
  const progress = clipDurationSec > 0 ? clipFrame / (clipDurationSec * fps) : 0;
  return interpolate(progress, [0, 1], [kb.from, kb.to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

interface FocusGeometry {
  scale: number;
  centerX: number;
  centerY: number;
}

/**
 * For fit="focus": scale the source so the focusRect region fills the canvas,
 * centered on the focusRect center. Shared by video and image layers — this is
 * the single source of truth for focus math.
 *
 * The returned center is the focusRect center in SOURCE pixels; the caller
 * sets transformOrigin to that point so kenBurns zoom scales about the focus
 * center (otherwise the focus center drifts as kb changes).
 */
function focusGeometry(focusRect: {x: number; y: number; w: number; h: number}, assetW: number, assetH: number): FocusGeometry {
  const scaleX = CANVAS_W / (assetW * focusRect.w);
  const scaleY = CANVAS_H / (assetH * focusRect.h);
  const scale = Math.max(scaleX, scaleY);
  const centerX = (focusRect.x + focusRect.w / 2) * assetW;
  const centerY = (focusRect.y + focusRect.h / 2) * assetH;
  return {scale, centerX, centerY};
}

/** Red-on-screen warning when fit=focus is declared but cannot be honored. Never silently degrade. */
function FocusWarning({message}: {message: string}) {
  console.error(message);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#FF0000",
        fontSize: 40,
        fontWeight: 700,
        fontFamily: "monospace",
        background: "rgba(0,0,0,0.45)",
        zIndex: 100,
        textAlign: "center",
        padding: 24,
      }}
    >
      {message}
    </div>
  );
}

/**
 * Shared focus container for video & image layers.
 * Scales the child media so the focusRect region fills the canvas (cover),
 * optionally combined with kenBurns zoom. `children` must be a single media
 * element that accepts a `style` prop (OffthreadVideo / Img / img).
 */
function FocusLayer({
  clip,
  assetW,
  assetH,
  children,
}: {
  clip: Clip;
  assetW: number;
  assetH: number;
  children: React.ReactElement<{style?: React.CSSProperties}>;
}) {
  const frame = useCurrentFrame();
  if (!clip.focusRect) {
    return <FocusWarning message={`clip "${clip.id}": fit=focus declared but focusRect missing — cannot render focus.`} />;
  }
  const fps = CANVAS.fps;
  const kb = kenBurnsScale(clip.kenBurns, frame, clip.duration, fps);
  const geo = focusGeometry(clip.focusRect, assetW, assetH);
  // transformOrigin = focusRect center (source px): with
  //   translate = canvasCenter - focusCenter, scale = s*kb
  // the focus center maps to canvasCenter for ANY kb:
  //   p' = translate + s*kb*(p - c) + c  =>  at p=c: p' = canvasCenter + c - c = canvasCenter ✓
  const transform = `translate(${CANVAS_W / 2 - geo.centerX}px, ${CANVAS_H / 2 - geo.centerY}px) scale(${geo.scale * kb})`;

  const mediaStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: assetW,
    height: assetH,
    transform,
    transformOrigin: `${geo.centerX}px ${geo.centerY}px`,
  };

  if (!isValidElement(children)) {
    return <FocusWarning message={`clip "${clip.id}": focus layer received no media element.`} />;
  }

  return (
    <div style={{position: "absolute", inset: 0, overflow: "hidden"}}>
      {cloneElement(children, {style: {...(children.props.style ?? {}), ...mediaStyle}})}
    </div>
  );
}

function VideoLayer({clip, asset}: {clip: Clip; asset: ManifestEntry}) {
  const fps = CANVAS.fps;
  // Remotion 4.0.499: startFrom/endAt are @deprecated aliases for trimBefore/trimAfter
  // (source: node_modules/remotion/dist/cjs/video/props.d.ts). We use the canonical names.
  const trimBefore = Math.round((clip.sourceIn ?? 0) * fps);
  const trimAfter = clip.sourceOut !== undefined ? Math.round(clip.sourceOut * fps) : undefined;
  const baseStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    position: "absolute",
    inset: 0,
  };
  const video = (
    <OffthreadVideo
      src={resolveAssetSrc(asset.path)}
      trimBefore={trimBefore}
      trimAfter={trimAfter}
      style={applyFit(baseStyle, clip.fit)}
    />
  );

  if (clip.fit === "focus") {
    const assetW = asset.width ?? CANVAS_W;
    const assetH = asset.height ?? CANVAS_H;
    return (
      <FocusLayer clip={clip} assetW={assetW} assetH={assetH}>
        {video}
      </FocusLayer>
    );
  }
  return video;
}

function ImageLayer({clip, asset}: {clip: Clip; asset: ManifestEntry}) {
  const frame = useCurrentFrame();
  const kb = kenBurnsScale(clip.kenBurns, frame, clip.duration, CANVAS.fps);
  const baseStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    position: "absolute",
    inset: 0,
  };

  if (clip.fit === "focus") {
    const assetW = asset.width ?? CANVAS_W;
    const assetH = asset.height ?? CANVAS_H;
    const img = (
      <Img
        src={resolveAssetSrc(asset.path)}
        style={{width: assetW, height: assetH}}
      />
    );
    return (
      <FocusLayer clip={clip} assetW={assetW} assetH={assetH}>
        {img}
      </FocusLayer>
    );
  }

  const style = {...baseStyle, transform: kb === 1 ? undefined : `scale(${kb})`};
  return <Img src={resolveAssetSrc(asset.path)} style={applyFit(style, clip.fit)} />;
}

function HtmlLayer({clip, asset}: {clip: Clip; asset: ManifestEntry}) {
  // HTML pages have no focus/fit semantics — if an EDL declares them, say so
  // instead of silently ignoring them.
  if (clip.fit === "focus" || clip.focusRect || clip.kenBurns) {
    console.warn(`HtmlLayer: clip "${clip.id}" declares fit/focusRect/kenBurns which have no effect on HTML pages`);
  }
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
      return <HtmlLayer clip={clip} asset={asset} />;
    default:
      return null;
  }
};





