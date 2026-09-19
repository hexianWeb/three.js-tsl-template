# iPhone Duo WebGPU 项目进度

> 最后更新：2026-09-19
> 当前阶段：Phase 2 — Runtime Rig 与折叠
> 当前状态：Phase 1 视觉校验通过；Phase 2 代码与功能检查完成，等待用户视觉校验

## 1. 进度摘要

Phase 1 模型加载、适配和场景显示已通过用户视觉校验。当前已建立 `ProductRoot`、`BottomRig`、`HingePivot` 与 `HingeVisualRig`，并在首次可见前应用 `8°` 近闭合姿态。

实施里程碑统计：

```text
Phase 1 / 7：完成
Phase 2 / 7：代码已产出
功能验证：完成
折叠视觉校验：等待用户
Git 提交：本轮已执行
```

这里不使用主观的总体百分比。后续 NDS 技术验证和视觉精修的工作量仍有不确定性，以七个实施阶段逐项统计更可靠。

## 2. 阶段状态

| 阶段 | 内容 | 状态 | 说明 |
|---|---|---|---|
| Phase 0 | PRD、GLB 调研、代码规则 | 已完成 | PRD 已扩充，项目规则已固化 |
| Phase 1 | Experience 架构、资源加载、模型适配 | 已完成 | 用户已确认模型在场景中显示正确 |
| Phase 1.5 | 模型坐标轴与 Transform 检查器 | 已完成 | 为任务二的铰链轴向校准提供基建 |
| Phase 2 | BottomRig、HingePivot、折叠原型 | 等待视觉校验 | 已实现 `8° / 110° / 180°` 可调姿态 |
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
| JavaScript 文件 | 15 |
| `src/js` 架构模块 | 14 |
| `src` 内全部文件 | 17 |

### 3.4 模型加载与适配

- 从 `/iphone.glb` 加载真实产品模型。
- 当前模型已移除 Controller 的最终材质，后续由程序生成程序化材质；现阶段默认外观不是资源加载错误。
- `Controller_Shell` 已接入独立 EXR Lightmap；最终程序化基础材质仍留待后续实现。
- 启动时集中校验 9 个必要节点。
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
Controller_Shell
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
- 支持从 PresentationRoot 和 9 个关键 GLB 节点中选择检查对象。
- 支持显示所选节点的局部坐标轴和世界包围盒。
- 支持一次显示全部关键部件的坐标轴。
- Tweakpane 实时显示所选节点的局部 / 世界 Position 与 Rotation。
- Transform 读数以 10 Hz 刷新，3D Helper 继续逐帧跟随，避免面板无意义高频刷新。

### 3.7 Runtime Rig 与折叠

- 新增 `ProductRig`，建立 `ProductRoot`、`BottomRig`、`HingePivot`、`HingeVisualRig` 与 `RuntimeAnchors`。
- 使用 `Object3D.attach()` 保持世界变换，将下半屏和 Controller 挂到 `BottomRig`，上半屏挂到 `HingePivot`。
- 从 `Hinge` 的局部包围盒动态推导中心与最长轴；当前模型运行时结果为 Z 轴，代码未硬编码 Blender 世界轴。
- 用户视觉校验已确认 `hingeAxisSign = +1`，并保留 Tweakpane 手动切换用于排查。
- GLB 的 `180°` Bind Pose 映射为产品角度，首次加入场景前应用 `8°`；Tweakpane 提供 `8°`、`110°`、`180°` 快速检查。
- 铰链视觉网格默认使用上半屏折叠量的 `0.5`，Controller 安装终点矩阵已相对 `BottomRig` 保存，供 Phase 3 使用。
- Coordinate Inspector 可检查新增的运行时 Rig 节点。
- Lighting 面板可实时调节 DirectionalLight 的 `shadowBias` 与 `shadowNormalBias`，用于处理模型细碎自阴影。
- 用户视觉校验已确认 `shadowNormalBias = 0.006`；`shadowBias` 暂时保持 `0`。
- 场景默认显示 Key DirectionalLight Helper，并可在 Lighting 面板中切换。

### 3.8 Controller Shell Lightmap

- `Resources` 使用 `EXRLoader` 加载 `/lightmaps/Controller_Shell_lightmap.exr`。
- 贴图为 2048 × 2048 Half Float 线性 HDR，运行时文件大小为 50,364,752 bytes。
- `Controller_Shell` 已包含独立 `TEXCOORD_1` (`uv1`)；Lightmap 使用 `channel = 1` 和 `flipY = true`。
- Lightmap UV 错位问题已由更新后的 GLB 与采样配置修复，并通过用户视觉校验。
- Lightmap 只绑定到 `Controller_Shell` 的独立材质，不影响按键、D-Pad 或显示面。
- Product Model 面板提供 `Controller Lightmap` 启用开关和 `0-5` 强度调节。

## 4. 验证记录

| 检查 | 结果 |
|---|---|
| `npm run build` | 通过 |
| JavaScript 构建检查 | 15 / 15 通过 |
| `git diff --check` | 通过 |
| 本地首页请求 | HTTP 200 |
| 本地 `main.js` 请求 | HTTP 200 |
| 本地 `iphone.glb` 请求 | HTTP 200 |
| GLB Content-Type | `model/gltf-binary` |
| GLB 文件大小 | 1,969,972 bytes |
| GLB 节点 | 40 |
| GLB Mesh | 28 |
| GLB 材质 | 11 |
| 必要节点校验 | 9 / 9 通过 |
| 坐标检查基建构建 | 通过 |
| Runtime Rig 父级与折叠数学检查 | 通过 |
| EXR 解码 | 2048 × 2048、Half Float、Linear sRGB 通过 |

构建存在一个非阻塞警告：Three.js WebGPU 相关入口打包后主 JavaScript Chunk 超过 Vite 默认 500 kB 提示阈值。当前阶段不做过早拆包，等 NDS Runtime 选型后统一规划按需加载。

## 5. Phase 2 用户视觉校验清单

本轮重点检查：

- 首次显示是否直接处于 `8°` 近闭合态，没有闪现 `180°` Bind Pose。
- `Product Rig` 的 `Folded 8°`、`Hero 110°`、`Bind 180°` 三个按钮是否分别得到合理姿态。
- 调节 `Product angle` 时，下半屏和 Controller 保持固定，只有上半屏围绕铰链长轴旋转。
- 上半屏在全角度范围内是否没有漂移、翻转或明显穿插；`Axis sign` 已确认使用 Positive。
- Hinge 视觉网格是否位于上下机身姿态中间；可调节 `Hinge visual mix` 辅助确认。
- 在 `Lighting` 中配合调整 `Shadow bias` 与 `Shadow normal bias`，记录能消除细碎阴影且不造成悬浮感的值。
- Coordinate Inspector 中的 `BottomRig`、`HingePivot` 和 `HingeVisualRig` 坐标轴是否稳定且符合预期。
- 切换 `Controller Lightmap` 并调整 Intensity，确认 GI 与 UV 对齐且没有接缝、翻转或局部过曝。

视觉校验发现的问题只需要记录角度、现象和期望姿态；可先在 Tweakpane 中确认参数，再固化默认值。

## 6. 已知问题与未决项

### 非阻塞问题

- `eslint.config.js` 引用了尚未安装的 `@antfu/eslint-config`，因此 ESLint 暂时不能运行。
- 当前未配置测试脚本或测试框架。
- 主 JavaScript Chunk 有体积警告，但构建成功。
- Controller Shell EXR 未压缩且约 50.4 MB，会显著增加首次加载时间；视觉确认后再决定是否压缩或降级。
- 当前灯光与镜头仅服务于模型及折叠校验，不是最终 Hero Shot。

### 尚未决定

- Hinge 自动推导轴向与铰链视觉中间姿态的最终确认。
- 最终 Hero / Play Camera 参数。
- GSAP 安装时机。
- NDS 模拟器与 Homebrew ROM 选型。
- NDS 上下屏 Canvas 输出的具体获取方式。

## 7. 当前工作区状态

本轮 Phase 2 主要改动为：

- 新增 `src/js/World/ProductRig.js`。
- 修改 `ModelAdapter`，在模型适配后建立运行时 Rig，并在加入场景前应用初始折叠姿态。
- 更新 Coordinate Inspector 的可选节点与本文档中的阶段状态。

## 8. 下一步

用户完成 Phase 2 视觉校验后：

1. 根据反馈固化默认产品角度与铰链视觉混合值。
2. 进入 Phase 3，使用已保存的 `ControllerInstalled` 矩阵建立 `ControllerEntry`。
3. 实现 Controller Reveal、Align、Slide、Lock 与可调回弹。
