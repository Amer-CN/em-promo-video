export const CANVAS = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

export const SAFE_AREA = {
  top: 120,
  bottom: 160,
  left: 80,
  right: 80,
} as const;

export const COLORS = {
  background: "#0E0E10",
  warmWhite: "#F5F0E8",
  yellow: "#E8C547",
  red: "#D8453C",
  blue: "#4A90D9",
  mutedGray: "#8A8A8A",
} as const;

export const EASING = {
  natural: "cubic-bezier(0.22, 1, 0.36, 1)",
  gentle: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;
