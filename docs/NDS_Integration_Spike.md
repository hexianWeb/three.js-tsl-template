# Phase 5 / pilas-melonds 独立验证与 3D 双屏接入

日期：2026-09-23。目标设备：用户的 i7-14700 + RTX 4060 桌面浏览器。

## 已实现

- 主产品首页：Continue → 按需载入 → 3D 双屏 Playing；Escape / 失焦 → 暂停并回到 Game Home；再次 Continue 接续会话。
- `World → NDSPlayer → NDSRuntime / NDSControls` 管理生命周期；`ScreenManager → NDSScreenBridge / NDSGameSurface` 管理屏幕。主场景复用 Experience 的动画循环，不新增 rAF。
- 上屏映射到 `Top_Screen_Plane`，下屏映射到 `Bottom_Display_Plane`，手机原生下屏在 Playing 隐藏。显示映射固定为上屏 `1.4:1`、下屏 `1:1`；4:3 主画面等比显示，空余区域用当前帧的整数倍最近邻像素 cover 略微压暗后延展，避免纯黑硬切。仅新模拟帧上传纹理。
- `InputRouter` 路由键盘、标准 Gamepad 与 3D Raycaster 触控；屏幕矩阵、flipY 与留黑区域共用于显示和触控。支持多键、Pointer 捕获、失焦释放、手柄断开与 Continue 输入隔离。
- 模式变化、Replay、取消和销毁会取消待处理启动，避免过期加载完成后跳回 Playing；文件读取无法中断时以请求版本丢弃过期结果。
- 独立入口 `/nds-test.html`，与产品主场景分开运行。
- 固定上游 commit `7adc554ce1dc5318fef3797e8f00a6e9286dac3b` 的 JS / WASM / AudioWorklet，原样放在 `public/vendor/pilas-melonds/`；来源与许可证随目录保留。
- `NDSRuntime`：DS Direct Boot、ROM 加载、约 59.8261 Hz 模拟调度、最多每次 update 追两帧、按键与触控、暂停、释放。核心使用内置 FreeBIOS 路径，此次未另行提供 BIOS / firmware。
- `NDSScreenBridge`：将 256 × 384 RGBA 帧缓冲同步复制成上下两张 256 × 192 Canvas，只在有新模拟帧时刷新。
- `NDSAudio`：复用上游 AudioWorklet 和 PCM 协议，点击后启用 48 kHz 立体声。暂停清空待播队列，静音期间仍取走核心音频。
- `NDSTestPage`：作为独立页生命周期父级拥有 Runtime、双屏与 rAF；监听器、HMR、窗口失焦与隐藏暂停均有清理路径。没有创建第二个 Experience。
- 可读取开发模式下的预置 ROM，也可通过文件选择器加载 `.nds`；错误在页面显示，避免只写 Console。
- 资源 URL 集中于 `sources.js` 的 `ndsSources`，按需加载，不加入主场景资源等待链。

测试文件：`public/nds/Pokemon - Platinum Version (USA) (Rev 1).nds`。文件保持原位、未修改。

## 验证记录

| 检查 | 结果 |
|---|---|
| `npm run build` | 通过，65 modules；主场景原有 chunk 体积提示仍在 |
| `git diff --check` | 通过 |
| `node scripts/verify-nds.mjs "public/nds/Pokemon - Platinum Version (USA) (Rev 1).nds"` | 真实 WASM 创建、载入、360 帧执行、双屏数据、active-low 按键掩码、暂停不推进、追帧上限与重复销毁通过 |
| Chrome headless / 开发页 | 已载入本地 ROM，按 A 后观察到 Platinum 标题页，上下屏均有游戏内容 |
| Chrome 短测性能 | 观察约 59–60 模拟 fps、约 99–100% 速度；WASM 分配内存约 309 MiB。不是 3D 同时运行的数据，也不是整段游戏的性能保证 |
| 音频 | AudioWorklet 加载成功，AudioContext 进入 running；实际听感和连续音画同步通过用户验收 |
| 页面交互 | 键盘、真实 Gamepad、下屏 Pointer、Escape 暂停、按钮继续与窗口失焦自动暂停均通过用户验收 |
| 无效 ROM | 页面可见错误，文件选择与重试入口恢复 |
| 构建资源 | `dist/nds-test.html` 与 vendor 产物存在；`dist/nds/` 不存在 |
| `node scripts/verify-nds-mapping.mjs` | 物理比例、非均匀缩放与旋转、4:3 contain / 整数像素 cover、延展区触控拒绝、镜像/旋转/flipY 触控闭环与新帧标记通过 |
| Chrome headless / 主产品 | 自动 Intro → Continue → 真实 3D 上下屏，截图已显示 Platinum 标题；屏幕材质路由、原生下屏隐藏、Playing 禁用 Orbit 通过 |
| 主产品合并性能短测 | 默认 GTAO 开启时，一次采样为 NDS 59.98 fps / 100.26%、场景 59.98 fps、核心均耗时 5.35 ms、WASM 308.5 MiB；不是长时间或所有游戏场景的性能保证 |
| 主产品输入与生命周期 | Enter 导航不穿透、键盘组合、模拟标准 Gamepad 输入/断开/Continue 隔离、真实 Raycaster 中心触控与拖出释放、Resize/DPR 触控、暂停不推进与不上传、会话恢复、Replay 取消异步启动、销毁期间加载收束均通过 |
| 生产预览 | 本地文件选择 → Playing → 音频启用 → 暂停 / 恢复通过；无 `/nds/` 网络请求、无未捕获错误。短测约 NDS 59.3 fps / 99%，场景 60.3 fps |

浏览器实测发现并修复：Vite 会对 public 路径的动态 import 添加 `?import` 并拒绝源码加载。Runtime 使用绝对 URL 与 `@vite-ignore`，保持第三方 ESM 原样加载。

## 使用

主产品：首页等待 Intro 完成（或 Skip Intro），通过 3D Controller 卡片、左下角 Continue、Enter 或标准手柄底部面键开始。开发环境默认使用测试 ROM，生产环境选择本地文件。进入 Playing 后 Enter 为游戏 Start，Escape 返回并暂停。左下角提供音频、文件选择、实时性能与操作提示。

独立对照页：

1. `npm run dev`，打开终端给出的地址加 `/nds-test.html`。
2. 点击载入测试游戏，待画面出现后点击启用声音。
3. 点击下屏让键盘焦点回到游戏。`X` 是 DS A，可用于跳过开场；标题页 `Enter` 是 Start。
4. 方向键 / X、Z、S、A / Q、W / Enter、Shift；点击下屏对应触控。
5. 建议连续玩十分钟，检查实际声音、输入、模拟速度以及暂停恢复。

## 当前边界与下一步

- 用户已确认主产品中的 NDS 上下屏映射、整数像素延展背景、连续游玩、声音与音画同步、触控、真实 Gamepad 及暂停恢复符合预期，Phase 5 验收完成。
- 主产品已替换 Playing 占位内容；独立验证页继续保留，用来对比纯模拟与 3D 合并负载。
- 当前不含 IndexedDB 持久存档和 3D 按键反馈。ROM 重新载入或页面刷新会开始新会话；后续可复用上游 IDBFS 存档桥接。
- 测试 ROM 不进入生产构建或 Git；预览构建使用本地文件选择器。Vite 保留开发期 public 服务，构建期显式复制除 `public/nds` 外的公共资源。
- 上游仓库提供预编译 web 产物，README 所述完整 C++ 构建树不在当前快照中；完整源码与二进制可复现关系仍未确认，已在 vendor NOTICE 记录。
- Phase 5 已完成；下一阶段实现由现有语义 Action 驱动的 Controller 3D 按键阻尼弹簧反馈。IndexedDB 持久存档仍是可选演示增强项。
