# iPhone Duo WebGPU Agent Guide

## 先读这些

- 修改 JS、TSL、场景、输入、动画或资源前，完整阅读 `.cursor/rules/iphone-duo-webgpu.mdc`。
- 产品结构、GLB 节点、折叠角度、Controller 装配和 NDS 路线以 `docs/iPhone_Duo_NDS_PRD.md` 为准；第 17-23、25 节是实现时的关键章节。
- 用 `docs/PROJECT_PROGRESS.md` 区分已实现与规划内容；PRD 和规则中的推荐目录、GSAP、NDS 模拟器等不代表依赖或模块已经存在。
- 文档与代码冲突时，以 `package.json`、`vite.config.js` 和当前源码为准，并修正文档假设，不要凭记忆补齐依赖、节点或资源。

## 命令与工具现状

- 使用 README 约定的 npm 流程：`npm install`、`npm run dev`、`npm run build`、`npm run preview`。仓库同时跟踪两个 lockfile；不要顺手删除或重生成未使用的 `pnpm-lock.yaml`。
- Vite 8 要求 Node `^20.19.0 || >=22.12.0`。Vite 的 root 是 `src/`，构建输出为根目录 `dist/`，公共目录仍是根目录 `public/`。
- 当前唯一可执行的代码检查是 `npm run build`；没有 test、lint、format 或 typecheck script，也没有测试框架。
- `@antfu/eslint-config` 已安装，但 `package.json` 没有 lint script；当前唯一约定的可执行检查仍是 `npm run build`，除非任务明确补充 lint 流程。
- Three.js WebGPU bundle 目前会触发 Vite 的 500 kB chunk 警告；构建成功时该警告不是失败。

## 当前执行流

- `src/index.html` 加载 `src/main.js`；`main.js` 检查 `navigator.gpu`，创建 `Experience`，等待 WebGPU、资源和 `World` 初始化，并在 Vite HMR dispose 时销毁实例。
- `Experience` 是全局生命周期单例。首次构造必须传 Canvas；Class 组件通过 `new Experience()` 取得同一实例。创建全局服务或动画循环时保持该边界。
- 初始化顺序是 Camera -> Renderer/WebGPU -> `Resources.load()` -> World -> `setAnimationLoop()`。资源完成前不要创建依赖模型的 World 组件。
- `World` 装配环境、`ModelAdapter`、`ScreenManager`、`CameraDirector`、`IntroDirector`、`NDSPlayer` 与 `InputRouter`；`ScreenManager` 协调模式与 Timeline，显示委托给 `PhoneScreenSurface`、`ControllerDisplay`、`NDSScreenBridge` 与 `NDSGameSurface`。`NDSPlayer` 持有 `NDSRuntime`、音频和隐藏的 DOM 控制（仅保留文件选择器），由 Experience 唯一循环更新。键盘、标准 Gamepad 和 3D 下屏触控已接入；Controller 锁上后 `ControllerFeedback` 就跟随按键，模拟器只在 Playing 接收这组 Action；持久存档仍待实现。
- NDS Continue 首次按需载入 WASM / ROM，完成后才进入 Playing；Escape、失焦和隐藏暂停并返回 Game Home，下一次 Continue 恢复会话。Replay、取消和销毁必须使未完成的异步启动失效。音频仅在有效用户激活期间自动解锁，其他情况保留独立启用按钮。
- NDS 映射固定为上屏 `1.4:1`、下屏 `1:1`；4:3 主画面由 `NDSGameSurface` 等比显示，空余区域使用当前帧的整数倍最近邻像素并略微压暗后延展。触控共用纹理矩阵且只响应清晰主画面；Game Home 与 Playing 允许小范围 Orbit，点在上下屏上时不旋转。`public/nds/` 是本地测试资源，已从 Git 和生产构建排除；`/nds-test.html` 保留独立验证入口。
- `Experience.init()` 在启动渲染循环后调用 `World.start()` 自动播放 Intro。IntroDirector 负责 Folded、Unfold、Screen Wake、Assembly、Game Changer、Hero 与 Ready 编排；Replay、Skip、Continue 收束和销毁必须停止自身、Controller 与屏幕转场 Timeline。`phone`、`attaching`、`game-home`、`playing` 是独立产品模式，不并入 `intro:state`。
- `CameraDirector` 监听 `intro:state` 驱动 Folded、Assembly、Hero 镜头，并监听 `product:mode` 驱动 Game Home / Playing 的 Hero、Play 镜头；镜头过渡期间关闭 OrbitControls。落位后 Game Home / Playing 以当前镜头为锚，限制方位、极角和距离；Tweakpane 的 Orbit Enabled 仍是自由取景，并可把当前取景写回单组镜头参数。
- 资源 URL 只在 `src/js/sources.js` 声明，组件通过 `resources.items` 的稳定名称读取。站点公共资源使用根路径，如 `/iphone.glb`。
- 生命周期由直接父级显式调用 `update`、`resize`、`destroy`。新增监听器、Tweakpane binding、GPU 资源或动画循环时必须接入同一销毁路径。

## WebGPU 与模型不变量

- Three.js 渲染类型从 `three/webgpu` 导入，TSL 从 `three/tsl` 导入；保持 `WebGPURenderer`、Node Material/TSL 和 Tweakpane 路线，不默认增加 WebGL、GLSL 或其他 GUI 回退。
- 当前运行时模型是 `public/iphone.glb`。10 个必需节点名集中在 `ModelAdapter`：`PHONE_ROOT`、`BottomHalf_NO_CAM`、`TopHalf_CAM`、`Hinge`、`CONTROLLER_ASSEMBLY_ROOT`、`Controller_ROOT`、`Controller_Shell`、`Top_Screen_Plane`、`Bottom_Screen_Plane`、`Bottom_Display_Plane`。
- `ControllerShellMaterial` 为 `Controller_Shell` 生成程序化磨砂塑料，纯 TSL 位于 `src/shaders/controllerPlastic.js`；`ControllerButtonMaterial` 为 ABXY / DPad 生成独立 Physical 清漆塑料并保留 GLB 底色。按键名称集中在 `ModelAdapter`，不把外壳 Lightmap 用于按键；不要为材质外观回退旧模型。
- `Controller_Shell` 的运行时 GI 使用 `/lightmaps/Controller_Shell_lightmap.exr`。该 2048² Half Float EXR 使用 `TEXCOORD_1` (`uv1`)，因此保持 `flipY = true`、线性色彩空间和 `channel = 1`；PNG 仅作预览。
- GLB Bind Pose 是 180 度完全展开态；下半屏固定，只旋转代码生成 Pivot 下的上半屏。首次可见前应用约 8 度近闭合态，当前 Hero/Play 目标为 110 度。
- Hinge 的 Pivot 和旋转长轴必须从模型局部包围盒推导，不能硬编码世界轴。重新挂接节点时保持世界变换并检查非均匀缩放。
- Controller 在 GLB 中的相对变换是唯一安装终点并跟随下半屏；整机展示变换只放在外层 `PresentationRoot`。
- Controller 装配使用 GSAP，Replay 前切到 110 度。当前模型滑轨轴推导为 Z，视觉确认方向为 `-Z`；方向可在 Tweakpane 覆盖。动画结束、Skip 和销毁都必须回到或保留精确安装矩阵。
- Phone UI 从 Fold 第一帧开始显示；Top Screen 的方向模糊、位移和折痕阴影由产品角度驱动，Screen Wake 只负责展开后的曝光与焦点稳定。
- Controller 装配期间 `Bottom_Display_Plane` 完全不可见，用户透过镂空看到 `Bottom_Screen_Plane`；Lock 完成后再执行 Phone UI -> Game Home 转场，结束时隐藏手机下屏并激活 Controller UI。
- 不回 Blender 增加 Pivot、Anchor 或 Camera，也不要迁移、重命名、压缩或替换用户提供的模型资源，除非任务明确要求。

## 修改约定

- 当前源码是 JavaScript ESM，不要自行迁移 TypeScript。JS 保持 2 空格、单引号、无分号。
- 为坐标系、矩阵、四元数、TSL 节点和阻尼参数补充解释约束的中文注释；不要逐行翻译代码。
- GSAP 已安装且只用于离散时间线；不要假定 Vue、Pinia、mitt、模拟器或测试工具已安装。新依赖只在当前任务需要时添加。
- 有交互或视觉变更时，运行 `npm run build` 并说明需要用户在支持 WebGPU 的最新版浏览器中完成视觉验收。
