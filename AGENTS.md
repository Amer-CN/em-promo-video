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
  → content/manifest.json（素材账本：id/path/type/durationSec/width/height/fps/hasAudio）
content/edl.json（剪辑决策，引用 manifest 的 assetId）
  → scripts/validate-edl.mjs（校验：时间轴连续无重叠空洞、sourceIn/Out 边界、字幕区间）
  → Remotion 渲染 src/index.ts Promo
  → output/*.mp4
```

## 命令

- `npm run doctor`：工具链 + 结构检查
- `npm run typecheck`：tsc --noEmit
- `npm run scan-assets`：扫描默认素材目录生成 manifest
- `npm run validate:edl`：校验 content/edl.json
- `npm run studio`：Remotion Studio 预览
- `npm run render -- Promo output/xxx.mp4`：渲染 composition
- `npx remotion render src/index.ts Promo output/smoke.mp4`：完整渲染命令

## 关键约定

- 时间单位：EDL 里全部用**秒**（sourceIn/sourceOut 是 clip 局部时间，timelineStart/duration 是时间轴绝对时间），组件内转帧（30fps）。
- fit 语义：cover=铺满裁剪 / contain=完整包含 / focus=取 focusRect 区域铺满（横屏录屏常用）。
- 素材 path：`public/` 下素材输出为相对路径（staticFile 可加载）；外部目录输出绝对路径。
- HTML 素材用官方 `<IFrame>` 组件渲染，其内置 delayRender 等待加载；**不要**再手写 delayRender，否则与官方机制冲突导致渲染超时。
- 字幕：底部安全区（160px）+ 其上 15% 画布高度内不放字；2–4 字一组换行。
