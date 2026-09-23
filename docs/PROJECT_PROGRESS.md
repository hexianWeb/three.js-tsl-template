# iPhone Duo WebGPU 项目进度

> 最后更新：2026-09-23
> 当前阶段：Phase 4 与阶段前 LookDev 验收完成；Phase 5 独立 NDS 最小验证已实现
> 当前状态：用户确认全部视觉待验收项通过；pilas-melonds 已在独立验证页启动本地 Platinum ROM 并显示标题页，主产品 3D 双屏桥接与连续游玩验收待完成

## 1. 进度摘要

Phase 2 Runtime Rig、折叠方向、阴影和 Controller Lightmap 已完成视觉校准。当前已实现角度驱动的 Fold Phone UI、可重播的 Controller 装配、装配期间的透明镂空，以及 Lock 后 Phone UI -> Game Home 转场和最小 Continue / 返回交互。

本轮补充了场景环境：灯光从 `World` 拆出为 `Environment` 组件并收紧了主光阴影相机，新增程序化展台桌板 `Stage`。HDR 环境贴图经实测否决，场景不设置 `scene.environment`。

实施里程碑统计：

```text
Phase 1 / 7：完成
Phase 2 / 7：完成
Phase 3 / 7：完成
Phase 4 / 7：完成（用户确认视觉校验通过）
功能验证：完成
装配视觉校验：通过
Git 提交：本轮已执行
```

这里不使用主观的总体百分比。后续 NDS 技术验证和视觉精修的工作量仍有不确定性，以七个实施阶段逐项统计更可靠。

## 2. 阶段状态

| 阶段 | 内容 | 状态 | 说明 |
|---|---|---|---|
| Phase 0 | PRD、GLB 调研、代码规则 | 已完成 | PRD 已扩充，项目规则已固化 |
| Phase 1 | Experience 架构、资源加载、模型适配 | 已完成 | 用户已确认模型在场景中显示正确 |
| Phase 1.5 | 模型坐标轴与 Transform 检查器 | 已完成 | 为任务二的铰链轴向校准提供基建 |
| Phase 2 | BottomRig、HingePivot、折叠原型 | 已完成 | 折叠方向、阴影和 Lightmap 已完成视觉校准 |
| Phase 3 | Controller Reveal / Assembly | 已完成 | 精密吸合时间线已通过用户视觉校验 |
| Phase 4 | Intro、Camera Shot、Ready / Play | 已完成 | 用户已确认浏览器视觉校验完成；进入 Phase 5 前增加 Controller Shell 材质 LookDev |
| Phase 5 | NDS 模拟器技术验证与双屏桥接 | 进行中 | pilas-melonds 独立验证页已启动用户提供的 Platinum ROM；3D 桥接与连续游玩待完成 |
| Phase 6 | Keyboard / Gamepad 与 3D 按键反馈 | 部分实现 | Continue 已支持 Enter / 标准 Gamepad A，Escape 可返回；通用游戏输入与 3D 按键反馈未实现 |
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
- 确认三块屏幕节点与模式职责：`Top_Screen_Plane` 为手机上屏，`Bottom_Screen_Plane` 为手机原生下屏，`Bottom_Display_Plane` 为 Controller 镂空上方、仅在 Lock 后激活的显示层。
- 确认三块屏幕 UV 均覆盖完整 `0–1`；比例差异由运行时 fit、letterbox 或 crop 处理，不扭曲 UV。

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
| JavaScript 文件 | 28 |
| `src/js` 架构模块 | 25 |
| `src` 内全部文件 | 30 |

### 3.4 模型加载与适配

- 从 `/iphone.glb` 加载真实产品模型。
- `Controller_Shell` 现由程序生成磨砂塑料；ABXY / DPad 使用保留原底色的独立 Physical 清漆塑料。
- `Controller_Shell` 已接入独立 EXR Lightmap，并保留在程序化塑料材质上。
- 启动时集中校验 10 个必要节点。
- 自动计算模型整体包围盒、中心与基础缩放。
- 使用外层 `PresentationRoot` 承担展示变换。
- 为模型 Mesh 启用基础投射与接收阴影。
- Tweakpane 支持位置、旋转、缩放、线框和节点状态检查。
- 加入 OrbitControls，便于用户进行视觉校验。

当前代码启动时校验的 10 个节点：

```text
PHONE_ROOT
BottomHalf_NO_CAM
TopHalf_CAM
Hinge
CONTROLLER_ASSEMBLY_ROOT
Controller_ROOT
Controller_Shell
Top_Screen_Plane
Bottom_Screen_Plane
Bottom_Display_Plane
```

补充屏幕语义确认：`Bottom_Screen_Plane` 用于 Phone Mode 的手机原生下屏。Controller 装配期间隐藏 `Bottom_Display_Plane`，用户透过镂空继续看到手机 UI；Lock 后转场才由 Controller 显示层接管，Game Home / Playing 再将上下内容映射到 `Top_Screen_Plane` / `Bottom_Display_Plane`。

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
- 支持从 PresentationRoot 和 10 个关键 GLB 节点中选择检查对象。
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
- 可实时调节 DirectionalLight 的 `shadow.radius`、`shadowBias` 与 `shadowNormalBias`。`radius` 是 PCF 软边宽度（阴影贴图像素），`Key shadow` 面板范围 `0–20`，当前源码值为 `10`；bias 用于处理模型细碎自阴影（面板后来从 `Lighting` 改名为 `Environment`，见 3.13）。
- 用户视觉校验已确认 `shadowNormalBias = 0.006`；`shadowBias` 暂时保持 `0`。
- 场景默认显示 Key DirectionalLight Helper，并可在面板中切换。

### 3.8 Controller Shell Lightmap

- `Resources` 使用 `EXRLoader` 加载 `/lightmaps/Controller_Shell_lightmap.exr`。
- 贴图为 2048 × 2048 Half Float 线性 HDR，运行时文件大小为 50,364,752 bytes。
- `Controller_Shell` 已包含独立 `TEXCOORD_1` (`uv1`)；Lightmap 使用 `channel = 1` 和 `flipY = true`。
- Lightmap UV 错位问题已由更新后的 GLB 与采样配置修复，并通过用户视觉校验。
- Lightmap 只绑定到 `Controller_Shell` 的独立材质，不影响按键、D-Pad 或显示面。
- Product Model 面板提供 `Controller Lightmap` 启用开关和 `0-5` 强度调节。
- 新增 `ControllerShellMaterial` 和 `controllerPlastic.js`：尺寸归一化局部噪声、粗糙度变化、表面梯度微法线与高频衰减；可选层纹默认关闭。
- `Controller Shell Plastic` 面板提供颜色、频率、粗糙度、坡度强度和打印层纹轴调节；方案校正详见 `Controller_TSL_Material_Implementation.md` 首节。
- 用户已确认外壳材质效果；新增 `ControllerButtonMaterial` 覆盖 ABXY / DPad，`Controller Button Plastic` 面板可调清漆强度、清漆粗糙度、底层 IOR 与微颗粒。按键不使用外壳 Lightmap。

### 3.9 Controller 装配

- 安装 GSAP，并新增 `ControllerAssembly` 管理独立、可重播和可销毁的装配 Timeline。
- Replay 自动将产品切到 `110°`，再执行 Reveal、Align、Slide 与 Lock。
- Controller 最新模型的纵向滑轨轴自动推导为 Z、对准旋转轴为 Y；用户视觉校验确认滑入方向为 `-Z`，XYZ 方向与偏移仍可在 Tweakpane 覆盖。
- Entry 从滑轨负方向进入；Reveal 用浅弧线和 `power3.out` 送进画面，Align 与 Reveal 后半重叠并消除默认 `3°` 偏角。
- Slide 用 `power3.in` 吸入滑轨并连续压过安装点约 `5%`，避免与 Reveal 一样在滑轨上匀速走；Lock 用 `back.out` 单次回弹后保留 Hold。
- 默认时间线总长约 `1.85s`：Reveal `0-0.8s`、Align `0.42-0.87s`、Slide `0.75-1.3s`、Lock `1.3-1.5s`、Hold `1.5-1.85s`。
- 动画只修改 Controller 的 Position 与 Quaternion，不修改 Scale；完成和 Skip 都恢复保存的精确安装矩阵。
- Controller Assembly 面板提供 Entry、Replay、Skip / Installed、阶段状态和全部距离、偏移、时长参数。

### 3.10 IntroDirector 基础状态流

- 新增 `IntroDirector`，由 `World.start()` 在渲染循环建立后自动播放。
- Intro 编排状态链为 `intro-folded → intro-unfold → screen-wake → controller-assembly → game-changer → hero → ready`；产品模式独立为 `phone → attaching → game-home → playing`。
- Folded 阶段保持 `8°` 并隐藏 Controller；Unfold 用 GSAP 动画到 `110°`，随后调用已完成的装配 Timeline。
- Unfold 先以 `power3.in` 在 `0.45s` 内从 `8°` 撕开到 `24°`，再以 `power3.out` 在 `1.55s` 内连续落到 `110°`，中间不停车。
- Hero 阶段进入 Game Home；Continue 会先终止 Hero Delay、收束 Intro 并进入 Playing，避免后续 Ready 事件把镜头拉回 Hero。
- Replay 会终止旧的 Intro、Hero Delay 与 Controller Timeline 后重建初始姿态；Skip 直接恢复 `110°` 和精确安装矩阵。
- Intro 与产品模式分别写入 `State.introState`、`State.productMode`，并发布 `intro:state`、`product:mode` 事件。

### 3.11 CameraDirector 基础镜头流

- 新增 `CameraDirector`，监听 `intro:state` 驱动 Folded、Assembly、Hero，并监听 `product:mode` 驱动 Game Home / Playing 的 Hero、Play 镜头。
- Folded 立即落位；Unfold 与 Assembly 镜头并行过渡；Hero 与 Ready 共用 Hero 镜头；Play 使用独立镜头。
- 镜头 Timeline 同步动画 Camera Position、OrbitControls Target 与 FOV，过渡期间禁用手动 Orbit。
- Tweakpane 支持单镜头预览、临时开启 OrbitControls 取景，以及将当前 Position、Target、FOV 回写到镜头参数。

### 3.12 ScreenManager 与 InputRouter

- `ScreenManager` 只协调 `phone`、`attaching`、`game-home`、`playing` 模式、三屏可见性和 Game Changer Timeline。
- `PhoneScreenSurface` 管理 Phone / Top Game 纹理、Node Material、Fold TSL 参数和 GPU 资源；`ControllerDisplay` 管理 Controller Canvas、显示材质、Continue 命中与按需纹理上传。
- Controller Game Home 使用参考图视觉语言重绘的运行时 `CanvasTexture`，Alto's Odyssey 卡片提供唯一真实 UI 动作 Continue；Playing 显示明确占位内容，不伪装为已接入 NDS 模拟器。
- Pointer 通过 Three.js Raycaster 命中 `Bottom_Display_Plane`，读取交点 UV 并命中测试 Continue 区域。
- Continue 的 Pointer、Enter 与标准 Gamepad button 0 / A 均路由到同一语义 Action；Escape 从 Playing 返回 Game Home。
- Phone Mode 与 Controller 装配、Game Changer 转场阶段不响应产品导航动作；只有转场完成进入 Game Home 后才激活 Continue。
- Controller CanvasTexture 已统一应用水平镜像与逆时针 `90°` 旋转，Continue 命中测试复用同一纹理 UV 变换。
- `ScreenManager.update()` 只在 Canvas 内容变化时上传纹理；销毁时只释放本模块创建的纹理和材质，并恢复 GLB 原始屏幕状态。
- `docs/img/主页面.png` 已通过 Vite 资源管线作为 Phone UI 加载；原图为 `1484 × 1060` 双联桌面，运行时按左右两个 `742 × 1060` 面板分别映射到手机上下屏。
- Phone UI 从 Fold 第一帧开始显示。Top Screen 使用 9-tap TSL 方向模糊、UV 位移与折痕阴影，默认从 `24°` 开始恢复并在 `85°` 清晰；Bottom Screen 在 `45°` 前完成轻度模糊和亮度恢复。
- Screen Wake 不再从黑场点亮，而是在 Unfold 完成后以默认 `1.5s` 稳定曝光与焦点，并额外停留 `4s` 供观察。
- Controller 装配期间 `Bottom_Display_Plane` 完全不可见，使镂空区域显示 `Bottom_Screen_Plane` 的 Phone UI。
- Lock 完成后停顿 `0.15s`，再以 `0.75s` Blur / Scale / Crossfade 将 Top Screen 切换到 `游戏模式主页面.png`、激活 Controller UI，并在结束时隐藏手机下屏。
- Phone UI 使用受 ACES 色调映射管理的 `MeshStandardNodeMaterial`，由独立 `Phone Screens` 面板调节自发光亮度、漫反射细节和粗糙度；默认亮度已从无色调映射的全亮状态降至 `0.38`。
- Phone UI 先裁成两张独立半幅 `CanvasTexture`，再执行镜像和旋转；当前校准基线为 `180°` 与上下屏面板对调，面板仍可切换 X / Y 镜像和四档旋转。
- Intro 面板新增 `screenWakeHold`、`Pause at Screen Wake`、`Inspect Screen Wake` 与 `Continue Assembly`；可无限期停留在完整点亮状态调试，再恢复装配流程。
- 新增 `Fold Screen Effect` 与 `Game Changer Transition` 面板，可检查角度、模糊、位移、折痕方向、镂空、转场进度、Game UI 朝向和亮度。

### 3.13 场景环境与展台

- 新增 `World/Environment/Environment.js`，把原先散在 `World.setEnvironment()` 的背景色、`HemisphereLight`、主光、补光与 Helper 收进独立组件，Tweakpane folder 从 `Lighting` 改名为 `Environment`，并补上了原先缺失的 folder dispose。
- 新增可调参数：背景色、曝光、三盏灯强度、主光 X / Y / Z 位置。曝光经 `Renderer.setExposure()` 修改，`Environment` 不直接写 Renderer 内部字段。
- 主光阴影相机不再使用 three 默认的 ±5 / near 0.5 / far 500，改为以光源到原点的距离为中心推导 near/far，正交范围由 `shadowExtent`（默认 3.6）控制。
- 新增 `World/Environment/Stage.js` 程序化展台：`RoundedBoxGeometry` + 非金属 `MeshStandardNodeMaterial`，调定 20 × 20 × 0.12，倒角 0.02。`receiveShadow = true`、`castShadow = false`，直接挂 Scene，不进入 `fitModel()` 包围盒。表面使用 `public/texture/` 下的 Plastic010 1K JPG（颜色 / OpenGL 法线 / 粗糙度），颜色乘色默认白，粗糙度默认按贴图原值（scale 1），`tileSize` 默认 2。
- 桌面高度经 `ModelAdapter.getStageSurfaceWorldY()` 运行时换算（Blender `Z = -0.035` → GLB 局部 Y → 世界 Y），未写死坐标。实测返回 `-0.09726002`，与文档推导一致。
- **HDR 环境贴图已否决。** `studio_small_03_1k.hdr` 接入 `scene.environment` 后实测观感更差——外壳 EXR Lightmap 本身是一次天光烘焙，叠加 studio HDR 后重复计光，画面被抬平。文件保留在 `public/hdr/` 但不进入 `sources.js`。
- 取消 HDR 的连带结果：场景**间接镜面为零**，清漆高光只来自两盏 DirectionalLight；间接漫反射只剩无方向的半球光。因此 GTAO 的优先级上升，详见 `docs/Scene_Lighting_Stage_Plan.md`。

### 3.14 GTAO 管线

- 新增 `Core/ScenePipeline.js`，由 `Renderer` 创建、逐帧调用、resize 与销毁。
- 使用 r186 `RenderPipeline`、几何法线 / 深度预通道、`GTAONode` 与 `DenoiseNode`；通过 `builtinAOContext` 影响间接光照，不直接乘最终颜色，保留屏幕自发光与直射高光。
- 预通道排除透明对象；默认半分辨率 AO、16 samples、radius 0.12、thickness 0.08、strength 1，全分辨率边缘保持降噪。不启用时间累积，避免引入历史帧拖影。
- `GTAO` 面板提供完全旁路开关、Scene / Raw AO / Denoised AO 预览及采样、分辨率、半径、厚度、强度和降噪半径。正常输出仅执行一次色调映射 / 色彩转换。
- `npm run build` 通过（53 modules），`git diff --check` 通过；CPU 检查覆盖目标尺寸、分辨率切换、旁路、预览、uniform 与目标释放。GPU 编译、视觉、帧耗时仍待浏览器验收。

## 4. 验证记录

| 检查 | 结果 |
|---|---|
| `npm run build` | 通过 |
| Vite 模块转换 | 46 modules，通过 |
| `git diff --check` | 通过 |
| Controller 塑料 TSL | 当前 WGSLNodeBuilder 已生成含噪声、法线梯度与 uv1 Lightmap 的代码；层纹开关两种状态通过，GPU 驱动编译与视觉待浏览器验收 |
| Controller 材质生命周期 | Uniform 调参、原材质恢复、独立面板/材质释放及共享 Lightmap 保留检查通过 |
| 按键清漆塑料 | WGSL 代码生成、清漆 Uniform 开关、5 个按键颜色保留与资源恢复/释放检查通过；浏览器视觉待验收 |
| 本地首页请求 | HTTP 200 |
| 本地 `main.js` 请求 | HTTP 200 |
| 本地 `iphone.glb` 请求 | HTTP 200 |
| GLB Content-Type | `model/gltf-binary` |
| GLB 文件大小 | 1,969,972 bytes |
| GLB 节点 | 40 |
| GLB Mesh | 28 |
| GLB 材质 | 11 |
| 必要节点校验 | 10 / 10 通过 |
| 坐标检查基建构建 | 通过 |
| Runtime Rig 父级与折叠数学检查 | 通过 |
| EXR 解码 | 2048 × 2048、Half Float、Linear sRGB 通过 |
| Controller 装配轴向推导 | Rail Z、Align Y 通过 |
| Controller 装配阶段时序 | 约 1.85s、Reveal/Slide 异向缓动与 Hold 待视觉复核 |
| Controller 动画终点矩阵 | 最大元素误差 0 |
| Intro / 产品状态流 | Folded → Unfold → Screen Wake → Assembly → Game Changer → Hero → Ready 已接入 |
| Camera Shot 状态映射 | Intro 与产品模式事件已分离；Folded / Assembly / Hero / Play 已接入 |
| Continue / 返回输入 | Pointer、Enter、标准 Gamepad A → Continue；Escape → Game Home 已接入 |
| Phone UI 资源构建 | `主页面.png` 已输出为独立 Vite Asset，通过 |
| Fold / Screen Wake 状态流 | Fold 第一帧显示 UI；Unfold 驱动模糊翻页；Screen Wake 稳定曝光与焦点，已接入 |
| Phone 屏幕材质控制 | Brightness / Diffuse detail / Roughness 与镜像、旋转、面板对调已接入 |
| Screen Wake 调试 | 时长、停留、自动暂停、独立检查与继续装配已接入 |
| Controller 镂空 | Attaching 隐藏显示层并暴露手机下屏，已接入 |
| Game Changer | Lock 后 Top / Bottom 双屏 Blur、Scale、Crossfade 转场，已接入 |

构建存在一个非阻塞警告：Three.js WebGPU 相关入口打包后主 JavaScript Chunk 超过 Vite 默认 500 kB 提示阈值。当前阶段不做过早拆包，等 NDS Runtime 选型后统一规划按需加载。

## 5. Phase 3 视觉校验结果

以下项目已通过用户视觉校验：

- 点击 `Replay Assembly` 后，产品是否先稳定在 `110°`，Controller 再从画面下方向上进入。
- Reveal 浅弧线、Align 与 Slide 的重叠是否自然，阶段之间不应出现明显停顿。
- 默认 `3°` 对准旋转是否自然；Controller 是否在进入滑轨前已完全对正。
- Slide 是否沿真实纵向滑轨连续压入，没有横向漂移、穿插手机或在安装点二次启动。
- Lock 过冲从不可见的 `0.3%–0.5%` 调整为约 `5%`，待确认回弹是否可感知但不夸张。
- 动画过程中 Lightmap 是否稳定跟随，阴影没有闪烁。
- 连续 Replay、Entry Pose、Skip / Installed 是否不会累计位移或破坏最终姿态。

当前装配参数作为 Phase 4 Intro 串联的默认基线。

## 6. 已知问题与未决项

### 非阻塞问题

- `eslint.config.js` 引用了尚未安装的 `@antfu/eslint-config`，因此 ESLint 暂时不能运行。
- 当前未配置测试脚本或测试框架。
- 主 JavaScript Chunk 有体积警告，但构建成功。
- Controller Shell EXR 未压缩且约 50.4 MB，会显著增加首次加载时间；视觉确认后再决定是否压缩或降级。
- 当前 Camera Shot 参数已由用户完成视觉校准，并已用于 Screen Wake 与 Phone UI 构图基线。

- Bind Pose `180°` 时整机最低点落到桌面下方 `-0.04463`，即上半屏摊平后穿过桌板。`180°` 只是 Tweakpane 调试姿态，Intro 与 Hero 都不会到达，暂不处理。
- `ModelInspector` 的 GridHelper 位于 `y = 0`，桌面在 `-0.097`，因此网格会浮在桌面之上遮挡 LookDev 视图，调外观时需手动关闭。
- `Environment` 的 `showKeyLightHelper` 默认仍是 `true`，生产前应改为 `false`。
- `Stage` 的 `width` / `depth` 滑杆上限就是当前调定的 20；若需更大桌面要先放宽 `Stage.debugInit()` 的 `ranges`。

### 尚未决定

- Hinge 自动推导轴向与铰链视觉中间姿态的最终确认。
- 最终 Hero / Play Camera 参数。
- 外部展台模型是否替换当前程序化桌板占位。
- 若清漆高光在验收中显得单薄，是否引入低强度 `RectAreaLight`（取消 HDR 后这是唯一能造出面光源高光的路径）。
- NDS 模拟器与 Homebrew ROM 选型。
- NDS 上下屏 Canvas 输出的具体获取方式。

### 已确认、后续实现

- 三块屏幕 UV 均已确认覆盖完整 `0–1`。
- `ScreenManager` 已实现 Phone Mode、Controller 装配、Game Home 与 Playing 的三屏材质和可见性规则。
- Screen Wake 与 Phone UI 已接入 `docs/img/主页面.png`，不再沿用 GLB 原始屏幕材质。
- `NDSRuntime` 和真实 NDS 上下屏 Canvas 已在 `/nds-test.html` 独立接入；主产品 Playing 仍使用占位内容，待完成 3D 桥接。
- 屏幕宽高比差异后续统一在运行时使用 fit、letterbox 或 crop 处理；触控输入尚未实现。
- Phase 4 和 Controller Shell 效果已由用户确认；新增按键清漆材质需独立 LookDev 验收。

## 7. 当前工作区状态

本轮 Phase 4 主要改动为：

- 新增 `src/js/World/Directors/IntroDirector.js`。
- `World.start()` 自动启动 Intro，`Experience` 不再提前把模式写成 Ready。
- `ControllerAssembly` 增加供 Intro 使用的可见性、跳过和完成回调边界。
- 新增 `CameraDirector`，接入四组镜头、状态映射、Orbit 锁定与 Tweakpane 取景工具。
- 新增 `ScreenManager` 与 `InputRouter`，接入独立产品模式、Controller Game Home、Continue 和 Escape 返回流。
- `State` 已将 Intro 编排与产品模式拆分为 `introState`、`productMode`。
- `ScreenManager` 已接入双联 Phone UI 分屏采样，`IntroDirector` 已接入可重播的 Screen Wake 时间线。
- 新增 `src/shaders/screenEffects.js`，通过 TSL 实现角度驱动 Fold 效果和 Game Changer 双屏转场。
- 接入 `游戏模式主页面.png`，并重绘 Controller Game Home Canvas UI。
- 将原 812 行 `ScreenManager` 拆分为模式协调器、`PhoneScreenSurface` 与 `ControllerDisplay`，保持 `World` / `IntroDirector` 公开调用不变。
- `src/js/World/` 已按 `Product/`、`Directors/`、`Screens/`、`Input/` 分层，根级只保留 `World.js` 作为装配入口。

本轮场景环境改动为：

- 新增 `src/js/World/Environment/Environment.js` 与 `src/js/World/Environment/Stage.js`，`World` 只负责装配与销毁。
- `Renderer` 新增 `setExposure()`；`ModelAdapter` 新增 `getStageSurfaceWorldY()` 与 `STAGE_SURFACE_MODEL_Y` 常量。
- HDR 实验已完整撤回：`sources.js`、`Resources.js` 恢复原状，`Environment.js` 中的 `environment*` 死参数已移除。`public/hdr/studio_small_03_1k.hdr` 保留在磁盘上但不被加载。
- 同步更新 `docs/Scene_Lighting_Stage_Plan.md` 与 PRD 第 29 节。

## 8. 下一步

2026-09-23 用户确认：此前全部待验收项目通过。上文待验收描述保留为当时的验证记录，以本次确认及文档顶部状态为准。

Phase 5 下一步：

1. 打开 `/nds-test.html`，在用户的 i7-14700 + RTX 4060 上连续游玩本地测试 ROM，确认声音、输入及运行速度。独立页已完成键盘、下屏触控、音频初始化和暂停 / 恢复的自动化短测。
2. 将已封装的 `NDSRuntime` 与 `NDSScreenBridge` 接入现有 Playing 模式，把真实上下屏映射到 Top Screen / Controller Display，并测量与 3D 场景同时运行的性能。
3. 补充 IndexedDB 存档、Gamepad 与 3D 下屏触控映射；3D 按键反馈仍按阻尼弹簧路线实现。

本轮实现、测试结果和使用方法见 `docs/NDS_Integration_Spike.md`。固定上游版本为 `7adc554ce1dc5318fef3797e8f00a6e9286dac3b`；ROM 仅本地验证，不进入生产构建。
