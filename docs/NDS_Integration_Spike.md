# Phase 5 / pilas-melonds 最小接入验证

日期：2026-09-23。目标设备：用户的 i7-14700 + RTX 4060 桌面浏览器。

## 已实现

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
| `npm run build` | 通过，60 modules；主场景原有 chunk 体积提示仍在 |
| `git diff --check` | 通过 |
| `node scripts/verify-nds.mjs "public/nds/Pokemon - Platinum Version (USA) (Rev 1).nds"` | 真实 WASM 创建、载入、360 帧执行、双屏数据、active-low 按键掩码、暂停不推进、追帧上限与重复销毁通过 |
| Chrome headless / 开发页 | 已载入本地 ROM，按 A 后观察到 Platinum 标题页，上下屏均有游戏内容 |
| Chrome 短测性能 | 观察约 59–60 模拟 fps、约 99–100% 速度；WASM 分配内存约 309 MiB。不是 3D 同时运行的数据，也不是整段游戏的性能保证 |
| 音频 | AudioWorklet 加载成功，AudioContext 进入 running；实际听感和连续音画同步待人工验证 |
| 页面交互 | 键盘事件、下屏 Pointer 派发、Escape 暂停、按钮继续、窗口失焦自动暂停通过；游戏内触控精度待人工确认 |
| 无效 ROM | 页面可见错误，文件选择与重试入口恢复 |
| 构建资源 | `dist/nds-test.html` 与 vendor 产物存在；`dist/nds/` 不存在 |

浏览器实测发现并修复：Vite 会对 public 路径的动态 import 添加 `?import` 并拒绝源码加载。Runtime 使用绝对 URL 与 `@vite-ignore`，保持第三方 ESM 原样加载。

## 使用

1. `npm run dev`，打开终端给出的地址加 `/nds-test.html`。
2. 点击载入测试游戏，待画面出现后点击启用声音。
3. 点击下屏让键盘焦点回到游戏。`X` 是 DS A，可用于跳过开场；标题页 `Enter` 是 Start。
4. 方向键 / X、Z、S、A / Q、W / Enter、Shift；点击下屏对应触控。
5. 建议连续玩十分钟，检查实际声音、输入、模拟速度以及暂停恢复。

## 当前边界与下一步

- 本轮是可复用 Runtime 的独立验证页，主产品 Playing 仍为占位。下一步由 World 持有 Runtime，通过 NDSScreenBridge / ScreenManager 映射到 `Top_Screen_Plane` / `Bottom_Display_Plane`，复用现有单一渲染循环。
- 本轮不含 IndexedDB 持久存档、Gamepad 和 3D 按键反馈。ROM 重新载入或页面刷新会开始新会话；后续可复用上游 IDBFS 存档桥接。
- 测试 ROM 不进入生产构建或 Git；预览构建使用本地文件选择器。Vite 保留开发期 public 服务，构建期显式复制除 `public/nds` 外的公共资源。
- 上游仓库提供预编译 web 产物，README 所述完整 C++ 构建树不在当前快照中；完整源码与二进制可复现关系仍未确认，已在 vendor NOTICE 记录。
- Phase 5 仍需人工连续游玩及 3D 合并运行验证，不能以构建成功或标题页启动代替完整验收。
