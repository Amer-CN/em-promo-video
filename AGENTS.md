# AGENTS.md

## 项目定位

em-promo-video 是一个**素材驱动**的竖屏（1080x1920 @ 30fps）宣传视频渲染仓库，基于 Remotion 4.0.499。

素材（录屏、截图、HTML 页面）放在 `public/`（或外部素材目录），由 `scripts/scan-assets.mjs` 扫描生成 `content/manifest.json` 账本；剪辑决策由 `content/edl.json`（EDL）描述；渲染器只做「有账本就能渲染」，不做任何自动剪辑决策。

## 与 douyin-video-agent-v2 的关系

本仓库**与 douyin-video-agent-v2 的文案驱动模型无关**。douyin-video-agent-v2 围绕 episode schema（口播文案、编辑结构）构建；em-promo-video 只消费素材清单 + EDL，**不要复用 episode schema**、不要复制 douyin 的 compositions / components / content / skills / vendor。

从 douyin-video-agent-v2 原样复制且保持一致的只有：
- `package.json` 的 dependencies / devDependencies（Remotion 版本必须完全一致，含 win32 二进制）
- `remotion.config.ts`、`tsconfig.json`
- `src/design/`、`src/utils/`
- `scripts/doctor.mjs`（结构检查清单已在目标仓库适配）

## 数据流

```
public/（素材）或外部目录
  → scripts/scan-assets.mjs --input <dir>（默认 D:\EngineeringManager\promo\raw）
      对每个视频跑 scene detection（ffmpeg select='gt(scene,0.15)',showinfo），
      输出 segments（场景切点连续段）+ 每段缩略图到 output/thumbnails/
  → content/manifest.json（素材账本：id/path/type/durationSec/width/height/fps/hasAudio/
      segments/thumbnails）
content/edl.json（剪辑决策，引用 manifest 的 assetId）
  → scripts/validate-edl.mjs（校验：时间轴连续无重叠空洞、sourceIn/Out 边界、字幕区间、
      可选 voiceoverDurationSec ≤ 时间轴总时长）
  → Remotion 渲染 src/index.ts Promo
  → output/*.mp4
UI 录制：scripts/record-ui.mjs（Playwright，EM_DEMO_MODE=1 强制）
```

## 命令

- `npm run doctor`：工具链 + 结构检查
- `npm run typecheck`：tsc --noEmit
- `npm run scan-assets`：扫描默认素材目录生成 manifest（含 scene detection + 缩略图；可用 `--scene-threshold` 调阈值、`--max-thumbnails` 限数量）
- `npm run validate:edl`：校验 content/edl.json（支持 `--edl <file>` 指定文件）
- `npm run record:ui -- --url <url> --duration <sec>`：Playwright 录 UI 演示，输出 output/recordings/
- `npm run studio`：Remotion Studio 预览
- `npm run render -- Promo output/xxx.mp4`：渲染 composition
- `npx remotion render src/index.ts Promo output/smoke.mp4`：完整渲染命令

## 关键约定

- 时间单位：EDL 里全部用**秒**（sourceIn/sourceOut 是 clip 局部时间，timelineStart/duration 是时间轴绝对时间），组件内转帧（30fps）。
- fit 语义：cover=铺满裁剪 / contain=完整包含 / focus=取 focusRect 区域铺满（横屏录屏常用）。
- 素材 path：`public/` 下素材输出为相对路径（staticFile 可加载）；外部目录输出绝对路径。
- HTML 素材用官方 `<IFrame>` 组件渲染，其内置 delayRender 等待加载；**不要**再手写 delayRender，否则与官方机制冲突导致渲染超时。
- 字幕：底部安全区（160px）+ 其上 15% 画布高度内不放字；2–4 字一组换行。
- **脱敏红线**：`scripts/record-ui.mjs` 必须 `EM_DEMO_MODE=1` 才执行（防真实客户名/金额录进要发布的视频），任何情况下不得绕过。
- EDL 的 meta.voiceoverDurationSec（可选）：一旦设置，校验强制「时间轴总时长 ≥ 配音时长」，接入 TTS 后先算配音时长再排时间轴。
- scdet 阈值 0.15 是录屏的猜测值，真实素材到位后需实测调参（`--scene-threshold`）。

