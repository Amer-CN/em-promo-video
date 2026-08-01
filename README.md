# em-promo-video

素材驱动的竖屏（1080x1920 @ 30fps）宣传视频渲染骨架，基于 Remotion。

- 素材账本：`content/manifest.json`（由 `scripts/scan-assets.mjs` 扫描生成）
- 剪辑决策：`content/edl.json`（EDL，时间轴 + clip + 字幕）
- 校验：`scripts/validate-edl.mjs`
- 渲染：`npx remotion render src/index.ts Promo output/smoke.mp4`

详见 [AGENTS.md](./AGENTS.md)。
