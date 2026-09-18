# iPhone Duo WebGPU 项目进度

> 最后更新：2026-09-18  
> 当前阶段：Phase 1.5 — 坐标检查基建
> 当前状态：代码与功能检查完成，等待用户视觉校验

## 1. 进度摘要

当前已经产出第一个可运行工程基线：旧的环面纽结示例已被移除，项目改为 `Experience` 单例与 Class 组件架构，并通过统一资源流程加载真实的 `iphone.glb`。

实施里程碑统计：

```text
Phase 1 / 7 已产出
功能验证：完成
视觉校验：等待用户
Git 提交：未执行
```

这里不使用主观的总体百分比。后续 NDS 技术验证和视觉精修的工作量仍有不确定性，以七个实施阶段逐项统计更可靠。

## 2. 阶段状态

| 阶段 | 内容 | 状态 | 说明 |
|---|---|---|---|
| Phase 0 | PRD、GLB 调研、代码规则 | 已完成 | PRD 已扩充，项目规则已固化 |
| Phase 1 | Experience 架构、资源加载、模型适配 | 等待视觉校验 | 构建、语法、节点与资源检查已通过 |
| Phase 1.5 | 模型坐标轴与 Transform 检查器 | 已完成 | 为任务二的铰链轴向校准提供基建 |
| Phase 2 | BottomRig、HingePivot、折叠原型 | 未开始 | 目标为 `8° → 110°` |
| Phase 3 | Controller Reveal / Assembly | 未开始 | 以 GLB 当前相对变换为安装终点 |
| Phase 4 | Intro、Camera Shot、Ready / Play | 未开始 | 计划使用 GSAP，尚未安装 |
| Phase 5 | NDS 模拟器技术验证与双屏桥接 | 未开始 | 模拟器与 Homebrew 尚未选定 |
| Phase 6 | Keyboard / Gamepad 与 3D 按键反馈 | 未开始 | 按键反馈使用阻尼弹簧 |
| Phase 7 | 性能、兼容性、Loading 与视觉精修 | 未开始 | 最终视觉验收由用户完成 |

## 3. 已完成内容

### 3.1 项目与产品文档

- 整理真实 Blender / GLB 节点层级。
- 确认不再回 Blender 增加 Pivot、Anchor 或 Camera。
- 确认 GLB 为 `180°` 的竖屏完全展开 Bind Pose。
- 确认目标展示夹角暂定 `110°`，上半屏相对 Bind Pose 旋转 `70°`。
- 确认下半屏固定、上半屏旋转、Controller 跟随下半屏。
- 确认 Controller 当前 GLB 相对变换就是最终安装终点。
- 保留 NDS Web 模拟器与合法 Homebrew ROM 路线。
- 明确 GSAP 与按键弹簧的职责边界。

### 3.2 项目规则

- 新增 `.cursor/rules/iphone-duo-webgpu.mdc`。
- 新增根目录 `AGENTS.md`，让 Codex 自动读取项目规则。
- 固化 `Experience` 单例、Class 生命周期、Tweakpane、资源与模型约定。
- 明确当前工程是纯 JavaScript，不使用 Vue 或 Pinia。
- 明确 `public/` 是公共资源目录，`static/` 不作为当前资源目录。

### 3.3 工程架构

- 建立 `Experience` 单例入口。
- 拆分 `Camera`、`Renderer` 与 `Debug`。
- 拆分 `Sizes`、`Time`、`State`、`EventBus` 与 `Resources`。
- 建立 `World` 与 `ModelAdapter`。
- 建立统一 `sources.js` 资源声明。
- 建立 `update()`、`resize()` 与 `destroy()` 生命周期。
- 保留 Vite HMR 销毁路径。

当前源码统计：

| 项目 | 数量 |
|---|---:|
| JavaScript 文件 | 14 |
| JavaScript 行数 | 750 |
| `src/js` 架构模块 | 13 |
| `src` 内全部文件 | 16 |

### 3.4 模型加载与适配

- 从 `/iphone.glb` 加载真实产品模型。
- 启动时集中校验 8 个必要节点。
- 自动计算模型整体包围盒、中心与基础缩放。
- 使用外层 `PresentationRoot` 承担展示变换。
- 为模型 Mesh 启用基础投射与接收阴影。
- Tweakpane 支持位置、旋转、缩放、线框和节点状态检查。
- 加入 OrbitControls，便于用户进行视觉校验。

已校验节点：

```text
PHONE_ROOT
BottomHalf_NO_CAM
TopHalf_CAM
Hinge
CONTROLLER_ASSEMBLY_ROOT
Controller_ROOT
Top_Screen_Plane
Bottom_Display_Plane
```

### 3.5 页面状态与错误处理

- WebGPU 不支持时显示明确提示。
- WebGPU 初始化阶段显示状态面板。
- GLB 加载过程显示资源进度。
- 资源或场景初始化失败时显示错误原因。
- 销毁时停止 AnimationLoop、移除事件并释放模型 GPU 资源。

### 3.6 坐标检查基建

- 新增 `ModelInspector` Class，并接入 World 更新与销毁生命周期。
- 坐标轴遵循 Three.js 约定：红色 X、绿色 Y、蓝色 Z。
- 支持显示世界原点坐标轴与 XZ 网格。
- 支持从 PresentationRoot 和 8 个关键 GLB 节点中选择检查对象。
- 支持显示所选节点的局部坐标轴和世界包围盒。
- 支持一次显示全部关键部件的坐标轴。
- Tweakpane 实时显示所选节点的局部 / 世界 Position 与 Rotation。
- Transform 读数以 10 Hz 刷新，3D Helper 继续逐帧跟随，避免面板无意义高频刷新。

## 4. 验证记录

| 检查 | 结果 |
|---|---|
| `npm run build` | 通过 |
| JavaScript 语法检查 | 13 / 13 通过 |
| `git diff --check` | 通过 |
| 本地首页请求 | HTTP 200 |
| 本地 `main.js` 请求 | HTTP 200 |
| 本地 `iphone.glb` 请求 | HTTP 200 |
| GLB Content-Type | `model/gltf-binary` |
| GLB 文件大小 | 4,900,748 bytes |
| GLB 节点 | 23 |
| GLB Mesh | 17 |
| GLB 材质 | 10 |
| 必要节点校验 | 8 / 8 通过 |
| 坐标检查基建构建 | 通过 |

构建存在一个非阻塞警告：Three.js WebGPU 相关入口打包后主 JavaScript Chunk 约为 962 kB、gzip 后约 253 kB，超过 Vite 默认 500 kB 提示阈值。当前阶段不做过早拆包，等 NDS Runtime 选型后统一规划按需加载。

## 5. 用户视觉校验清单

本轮不由开发代理代替用户做视觉验收。用户可重点检查：

- 模型是否完整显示，有无缺失 Mesh。
- Controller 与手机的相对位置是否仍然保持 Blender / GLB 原样。
- 模型朝向是否符合预期，正反面有没有颠倒。
- 当前自动居中与缩放是否便于观察。
- GLB 材质颜色、透明度、金属感和屏幕表面是否正常。
- OrbitControls 的旋转、缩放和拖动是否顺手。
- Tweakpane 的 Position、Rotation、Scale 与 Wireframe 是否生效。
- `Coordinate Inspector` 的红 X、绿 Y、蓝 Z 是否清晰可辨。
- 切换关键节点时，局部 / 世界坐标读数和包围盒是否跟随变化。
- `All part axes` 是否能显示各关键部件的方向。
- 页面 Loading 是否能在模型加载完成后消失。

视觉校验发现的问题只需要记录现象和期望结果；基础 Transform 可以先在 Tweakpane 中试出合适数值，再固化到默认配置。

## 6. 已知问题与未决项

### 非阻塞问题

- `eslint.config.js` 引用了尚未安装的 `@antfu/eslint-config`，因此 ESLint 暂时不能运行。
- 当前未配置测试脚本或测试框架。
- 主 JavaScript Chunk 有体积警告，但构建成功。
- 当前灯光与镜头仅服务于模型校验，不是最终 Hero Shot。

### 尚未决定

- 用户视觉校验后的默认模型 Transform。
- Hinge 运行时长轴与旋转正负方向的最终校准。
- 最终 Hero / Play Camera 参数。
- GSAP 安装时机。
- NDS 模拟器与 Homebrew ROM 选型。
- NDS 上下屏 Canvas 输出的具体获取方式。

## 7. 当前工作区状态

本轮改动尚未提交。主要内容包括：

- 修改 `readme.md`、`src/index.html`、`src/main.js` 与 `src/style.css`。
- 删除旧示例 `src/material.js`。
- 新增 `src/js/` 架构文件。
- 新增项目规则与本文档。
- `public/iphone.glb`、`docs/` 与项目规则仍处于未跟踪状态。
- `.worktrees/` 是既有未跟踪目录，本轮未修改也不会纳入提交。

## 8. 下一步

用户完成本轮视觉校验后：

1. 根据反馈固化模型默认 Transform 与基础镜头。
2. 创建 `BottomRig`、`HingePivot` 与 `HingeVisualRig`。
3. 从 `Hinge` 局部包围盒推导 Pivot 与长轴。
4. 完成 `8° → 110°` 可调折叠原型。
5. 在 Tweakpane 中暴露产品角度、轴向符号与铰链中间姿态。
6. 功能检查通过后进入 Controller 装配阶段。
