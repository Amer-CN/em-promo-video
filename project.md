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


---

# 第二轮：审查反馈补齐（2026-08-01）

背景：外部审查者反馈三项缺口（scdet 场景切分、record-ui 录制、配音时长校验），并因私有仓库 404 读不到代码。**注意：这三项并不在我第一轮收到的任务指令里**（第一轮 scan-assets 要求明确是「递归扫描 + ffprobe 元数据 + manifest.json，只读不转码」，无 scdet；无录制脚本；validate-edl 规则是时间轴/source 边界/字幕三条）。本轮按用户确认补齐，属新增需求而非「漏做补交」。

## 仓库可见性
- ✅ VERIFIED：`gh repo edit Amer-CN/em-promo-video --visibility public`，现为 PUBLIC（用户决策）。

## 三项补齐

### 1. scdet 场景切分（scan-assets.mjs）
- ✅ VERIFIED：`sceneCuts()` 跑 `ffmpeg -i <file> -vf "select='gt(scene,0.15)',showinfo" -f null -`，解析 `pts_time` 得切点；`makeSegments()` 转连续段；`extractThumbnails()` 每段中点取一帧到 `output/thumbnails/<id>__<n>.jpg`。
- 参数：`--scene-threshold`（默认 0.15）、`--max-thumbnails`（默认 20）。
- 实测：`node scripts/scan-assets.mjs --input public/sample` → video_mp4 1 segment + 1 缩略图（合成素材 testsrc2 画面平滑，段数少属预期）。manifest.json 的 video 条目新增 `segments`/`thumbnails`；zod `manifestEntrySchema` 同步加了可选字段。
- ⚠️ 阈值 0.15 只是录屏猜测值，真实录屏到位后必须实测调参（UNVERIFIED for real footage）。

### 2. record-ui.mjs（Playwright 录制）
- ✅ VERIFIED：`npm install -D playwright` + `npx playwright install chromium`（chromium-1234）成功。
- ✅ 安全阀：无 `EM_DEMO_MODE=1` → `REFUSED` + exit 1（脱敏红线）。
- ✅ 端到端：`EM_DEMO_MODE=1 node scripts/record-ui.mjs --url file:///...card.html --duration 3` → webm + ffmpeg 转 mp4（1920x1080/25fps）成功。
- ⚠️ 真实 EM 系统 URL 与 UI 未录制过（UNVERIFIED）；Playwright recordVideo 输出 webm，默认 25fps，promo 时间轴是 30fps——真实链路要转码后对帧率，尚未处理。

### 3. 配音时长校验
- ✅ VERIFIED：EDL meta 新增可选 `voiceoverDurationSec`（edl.schema.json + zod）；validate-edl 新增「时间轴总时长 ≥ 配音时长」。
- ✅ 正测试：8s ≤ 10s → OK（打印 `voiceover 8s covered by timeline 10s`）；负测试：12s > 10s → FAILED exit 1。
- 当前 edl.json 未设该字段，不触发。接入 TTS 后先算配音时长再排时间轴。

## 回归验收
- ✅ `npm run doctor` → OK
- ✅ `npm run typecheck` → exit 0
- ✅ `npm run validate:edl` → OK (3 clip(s), 0 warning(s))
- ✅ smoke 渲染 30 帧 → 成功（新 manifest schema 未破坏渲染链路）

---

## 第三轮修复记录（2026-08-01）

### P0-1 素材路径 —— PASS（含渲染级验证）
- 修复：`public/raw` junction → `D:\EngineeringManager\promo\raw`（.gitignore 已加）；scan-assets `DEFAULT_INPUT` 改为 `public/raw`，`assetPath()` 只输出 public 相对路径，public 外文件报错退出（exit 1 + 提示建 junction 命令，实测 tmp/outside 验证）；`resolveAssetSrc` 对盘符路径（正/反斜杠）throw。
- 渲染级验收：注入含 `D:/...` 绝对路径的 manifest 渲染，浏览器端明确抛 `resolveAssetSrc: absolute path ... cannot be rendered via staticFile()`——明确报错而非黑屏。
- 额外修复：Remotion 4.0.499 在 Windows 打包 public/ 时对 junction 用无 type 的 `fs.symlink` 导致 EPERM；`scripts/patch-remotion.mjs` 改为 `type="junction"`（无需管理员），幂等，postinstall 自动应用。

### P0-2 video fit=focus —— PASS（抽帧主色验证）
- 修复：focus 几何抽成公共 `FocusLayer`（video/image 共用）；`applyFit` 补 focus 分支；fit=focus 但缺 focusRect 时红屏警示不静默降级。
- 验收：quadrants.mp4（红/绿/蓝/黄四象限 1920x1080）fit=focus focusRect=右下象限，渲染后抽帧 `output/review/focus-mid.png`、`focus2-mid.png`：整帧主色 #F0E000（亮黄）——右下角被放大填满，非中间裁切。
- kenBurns 焦点锚定（审查 P1 修复）：`output/review/kb-first.png`（kb=1.0）与 `kb-last.png`（kb=1.06）均整帧纯黄，焦点中心不随缩放漂移（transformOrigin=焦点中心 + translate=画布中心-焦点中心）。

### P0-3 字幕逐组闪现 —— PASS（抽帧 diff 验证）
- 修复：同一时刻只显示一组（单行居中 2-4 字）；字幕 [start,end] 按组数等分逐组切换，组首 3 帧快速淡入（interpolate，非 spring）；groupChars 三阶段（标点硬切→4 字上限避免拆双字词→单字合并）；NO_TEXT_ZONE_FRACTION=0.15 迁入 design/tokens.ts。
- 验收：纯黑背景 + 3 句字幕（欢迎使用本产品 / 三步完成配置 / 马上开始吧）渲染 `output/review-sub.mp4`，抽 6 帧（g1a/g1b/g2a/g2b/g3a/g3b）：
  - bbox 验证：文字 x 415-664（居中）、y 1406-1465（单行）、宽度 120-249px（2-4 字）；
  - 组间 diffPx=5902/8066/6433（组随推进切换）；
  - 同组内 f5 vs f12 diffPx=0（稳定无闪变）。

### P1 参数化与真源 —— 完成
- P1-1 EDL 参数化：`scripts/render-edl.mjs --edl <path>` 在 node 端读文件→注入内容 props→调 remotion render（focus/subtitle/kb 三个验收均用它渲染成功）。**架构事实（如实报告）**：Remotion 4.0.499 的 calculateMetadata 在渲染器浏览器页面内运行（`node_modules/@remotion/renderer/dist/select-composition.js` 通过 puppeteer evaluate `window.remotion_calculateComposition`），浏览器 bundle 无法读文件系统；因此裸 `--props='{"edlPath":...}'` 必然报 "missing edl content"（已实测）。等价能力由包装脚本提供，为自动生成账本铺路。
- P1-2/3：fps 全收敛 CANVAS.fps（MediaClip/Promo/Root）；VideoLayer endAt 无 sourceOut 时传 undefined（不再 ?? 0）。
- P1-4：源码确认 `node_modules/remotion/dist/cjs/video/props.d.ts` 中 startFrom/endAt 标 @deprecated，改名为 trimBefore/trimAfter；MediaClip 已改用现行 API。
- P1-5：record-ui 转码加 `-vf fps=30`，ffprobe 确认输出 30/1。

### P2 —— 完成
- probe() 跳过 html（不再对 card.html 跑 ffprobe）；sceneCuts 加 `-an` + `scale=480:-1` 降采样 + spawn 流式读 stderr（长视频不堆内存），pts_time 跨 chunk 拼接（审查 P2-1）；collectFiles 显式跟随 junction/symlink 目录并报告 broken link（审查 P2-2，`--input public` 实测 6 素材正常）。
- package.json 加 postinstall 自动应用 Remotion 补丁（审查 P2-3）。

### 功能缺口：record-ui steps —— 完成
- `content/recordings.json`（demo-app：hover/fill/click/wait/scroll 6 步）在合成 HTML 上端到端跑通，每步间默认 600ms 停顿（pauseMs 可覆盖）；EM_DEMO_MODE=1 安全阀一字未改（缺失时 REFUSED exit 1）。

### 独立审查（read_only_task）
发现并修复：P1 focus+kenBurns 焦点漂移（见 P0-2 验收）；P2 pts_time 跨 chunk、junction 穿透、postinstall 补丁持久化、groupChars 空输入、淡入短组退化。

### 验收状态
- doctor / typecheck / validate:edl 全绿。
- 抽帧全部存 `output/review/`：focus-mid、focus2-mid、kb-first、kb-last、g1a-g3b（subtitle）、sub-*。
- 全部为「看画面后写 PASS」（主色/bbox/diffPx 程序化人眼替代，已逐张说明看到了什么）。
