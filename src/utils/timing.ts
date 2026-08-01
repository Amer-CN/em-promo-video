import {interpolate, Easing} from "remotion";

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

export function easeNatural(
  frame: number,
  inputRange: [number, number],
  outputRange: [number, number],
): number {
  return interpolate(frame, inputRange, outputRange, {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
