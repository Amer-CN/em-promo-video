import {Easing, interpolate} from "remotion";

export const EDITORIAL = {
  colors: {
    black: "#080807",
    warmBlack: "#11100e",
    warmGray: "#1d1b18",
    paper: "#f1ece2",
    pale: "#c9c2b6",
    dim: "#777168",
    red: "#8f1d1d",
    deepRed: "#4f1010",
  },
  fonts: {
    sans: '"Editorial Sans SC", "Noto Sans SC", sans-serif',
    serif: '"Editorial Serif SC", "Noto Serif SC", serif',
  },
  safe: {top: 120, right: 72, bottom: 116, left: 72},
  type: {
    hero: 344,
    impact: 252,
    title: 126,
    section: 98,
    body: 70,
    micro: 18,
  },
  texture: {
    black: "linear-gradient(112deg, rgba(255,255,255,.018) 0%, transparent 24%, rgba(143,29,29,.035) 67%, transparent 100%), linear-gradient(180deg, #080807 0%, #0d0c0b 54%, #080807 100%)",
    gray: "linear-gradient(160deg, #1e1c19 0%, #11100e 46%, #080807 100%)",
  },
  timing: {
    blackout: 8,
    shortPause: 12,
    readingPause: 24,
    endingHold: 24,
  },
} as const;

export const EDITORIAL_EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const CLAMP = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;

export const editorialRange = (frame: number, input: number[], output: number[]) =>
  interpolate(frame, input, output, {...CLAMP, easing: EDITORIAL_EASE});

export const editorialWindow = (
  frame: number,
  start: number,
  inEnd: number,
  outStart: number,
  end: number,
) => interpolate(frame, [start, inEnd, outStart, end], [0, 1, 1, 0], CLAMP);

export const readableClip = (reveal: number, direction: "left" | "right" | "up" | "down" = "left") => {
  const safeReveal = Math.max(0, Math.min(100, reveal));
  return {
    left: `inset(0 ${100 - safeReveal}% 0 0)`,
    right: `inset(0 0 0 ${100 - safeReveal}%)`,
    up: `inset(0 0 ${100 - safeReveal}% 0)`,
    down: `inset(${100 - safeReveal}% 0 0 0)`,
  }[direction];
};
