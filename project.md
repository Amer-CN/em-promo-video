# project.md — em-promo-video 交付记录

日期：2026-08-01
任务：搭出素材驱动的竖屏视频渲染骨架（「有账本就能渲染」链路）

## 验收项逐条记录

| # | 验收项 | 状态 | 证据 |
|---|--------|------|------|
| 1 | npm run doctor 通过 | ✅ VERIFIED | `npm run doctor` → `OK: all checks passed` |
| 2 | npm run typecheck 通过 | ✅ VERIFIED | `npm run typecheck` → exit 0 无错误 |
| 3 | 3-clip 手写 edl.json（录屏+截图+HTML），validate:edl 通过 | ✅ VERIFIED | `node scripts/validate-edl.mjs` → `validate-edl: OK (3 clip(s), 0 warning(s))` |
| 4 | remotion render 出 10 秒 mp4 | ✅ VERIFIED | `npx remotion render src/index.ts Promo output/smoke.mp4` → 300/300 帧完成，`output/smoke.mp4`（2.4 MB） |
| 5 | ffprobe 确认 1080x1920 / 30fps | ✅ VERIFIED | ffprobe → width=1080, height=1920, r_frame_rate=30/1, duration=10.0s, codec=h264 |

## 交付物

- git 仓库：`~/Developer/em-promo-video`，远程 `Amer-CN/em-promo-video`
- 从 douyin-video-agent-v2 复制：dependencies/devDependencies 全块、remotion.config.ts、tsconfig.json、src/design/、src/utils/、scripts/doctor.mjs
- 未复制：content/、src/compositions/、src/components/、skills/、vendor/（新仓库的 content/src 为自有内容）
- 新增：scripts/scan-assets.mjs、content/edl.schema.json、src/schemas/edl.ts、scripts/validate-edl.mjs、src/components/MediaClip.tsx、src/components/Subtitle.tsx、src/compositions/Promo.tsx、src/Root.tsx、src/index.ts、AGENTS.md

## 如实说明（未跑过 / 有偏差的）

1. **scan-assets 默认输入目录 `D:\EngineeringManager\promo\raw` 不存在**。
   - `npm run scan-assets`（不带参数）未在此机器上真实跑过 → UNVERIFIED。
   - 已用 `--input public/sample` 验证脚本本身：成功扫描 3 个测试素材生成 `content/manifest.json`（此时脚本路径逻辑已验证）。
   - 生产 manifest 需素材目录就位后重跑。

2. **doctor.mjs 做了适配**：源 douyin 版本的 requiredDirs/requiredFiles 检查的是旧项目结构（episode schema 等）。复制到新仓库后只改了**检查清单**（目录/文件列表、标题），工具链检查逻辑原样。源项目文件未改动。

3. **HTML 素材的加载时序**：最初手写 delayRender + iframe onLoad 等待，渲染到 HTML clip 段（帧 217+）时 delayRender 超时（28s 未清除）失败。查 Remotion 文档+源码确认：官方 `<IFrame>` 组件**已内置** delayRender 并在 onLoad 时 continueRender。改用官方组件（不再手写 delayRender）后渲染全流程通过。**结论：Remotion 对 iframe 有官方加载等待机制，不是缺陷；但手写 delayRender 会与其冲突，切勿叠加。**
   - 备注：HTML clip 渲染时 iframe 内容为本地 staticFile，实测在渲染进程可正常加载。真实线上 HTML（含外部资源/动画）未验证 → 动画类内容不建议（Remotion 只保证 useCurrentFrame 驱动的动画同步，iframe 内动画不保证）。

4. **素材与测试数据**：测试素材（video.mp4 6s/1920x1080/30fps/有音轨、screenshot.png 1920x1080、card.html 1080x1920）是 ffmpeg 生成的合成素材，放在 `public/sample/`，仅用于 smoke 验证，**不是真实产品素材**。

5. **fit=focus / kenBurns / 字幕分组**：已在代码中实现并有 edl 用例（focus+kenBurns 用于截图 clip，字幕 3 条），渲染跑通，但**未逐帧人工检视视觉效果** → 视觉质量 UNVERIFIED。

6. **git push**：✅ VERIFIED。远程仓库原本不存在，已用 `gh repo create Amer-CN/em-promo-video --private` 创建（PRIVATE），`git push -u origin main` 成功，默认分支 main，工作区干净。commit: `2719088 feat: asset-driven vertical promo video skeleton (Remotion)`（29 files, 5105 insertions）。

## 目录结构

```
content/edl.schema.json   EDL JSON Schema
content/edl.json          手写 3-clip 剪辑决策（smoke 用）
content/manifest.json     scan-assets 生成的素材账本（来自 public/sample）
scripts/scan-assets.mjs   素材扫描 → manifest
scripts/validate-edl.mjs  EDL 校验
scripts/doctor.mjs        工具链 + 结构检查
src/schemas/edl.ts        zod schema + 类型（含 ManifestEntry）
src/components/MediaClip.tsx  video/image/html 分派 + fit/focus/kenBurns
src/components/Subtitle.tsx   安全区 + 2-4 字分组
src/compositions/Promo.tsx    时间轴渲染
src/Root.tsx / src/index.ts   composition 注册
public/sample/            smoke 测试素材
```

