# iPhone Duo → NDS Web 交互原型 PRD

## 1. 项目概述

本项目旨在制作一个基于 **Blender + Three.js** 的网页端 3D 交互原型，用于展示：

> 将 iPhone Duo 与一体式外置 Controller 组合后，转变为类似 NDS / 3DS 的双屏掌机形态。

用户进入网页后，会先观看一段产品级 3D 入场动画，了解 iPhone Duo 的折叠形态、展开过程以及 Controller 的滑轨式安装方式；随后进入可交互的 Playable Demo，通过键盘或实体手柄操作游戏，并实时看到 3D Controller 按键反馈以及上下双屏的不同显示内容。

本项目重点不是从零开发完整 NDS 模拟器，而是验证和展示：

- iPhone Duo 作为双屏设备的游戏形态
- 外置 Controller 的产品设计概念
- 浏览器实时 3D 产品展示
- 双屏游戏交互体验
- Gamepad / Keyboard 与 3D 按键的实时映射

---

## 2. 产品目标

### 2.1 核心目标

```text
加载网页
→ 展示折叠状态的 iPhone Duo
→ Duo 自动展开
→ 双屏点亮
→ Controller 出场
→ Controller 沿滑轨安装到底部机身
→ 形成 NDS 风格双屏掌机
→ Hero Shot
→ 用户进入 Playable Demo
```

用户最终应清楚理解：

> iPhone Duo 可以通过一个整体式 Controller 配件，转换为类似 NDS 的双屏掌机。

### 2.2 非目标

V1 暂不实现：

- 自研完整 NDS 模拟器（允许集成现有 WebAssembly NDS 模拟器）
- 真实柔性 OLED 折叠形变
- 复杂物理滑轨
- L / R 肩键
- L2 / R2
- 大型完整游戏
- 多种 Controller 外观
- Controller 安装后的再次折叠
- 完整手机系统模拟
- 高复杂度装配编辑器

---

## 3. 产品形态

### 3.1 iPhone Duo

- `TopHalf_CAM`
  - 有 Camera 的一侧
  - 作为最终 NDS 上屏

- `BottomHalf_NO_CAM`
  - 无 Camera 的一侧
  - 作为最终 NDS 下屏
  - 安装到 Controller 内部

- `Hinge`
  - 用于入场动画中的折叠 / 展开

### 3.2 Controller

Controller 为一个整体式外置底座，不采用左右分离结构。

主要包含：

- 蓝色 Controller 外壳
- 左侧 D-Pad
- 右侧 ABXY
- 中央下屏显示区域
- 内部滑轨结构

V1 暂不设计肩键。

Controller 与 Duo Bottom 采用：

> 纵向滑轨式安装。

安装完成后，Controller 外壳会遮挡 iPhone Duo 下半机身的大部分区域，仅露出中央下屏显示区域。

---

## 4. 双屏设计

### 4.1 上屏

对应节点：

```text
Top_Screen_Plane
```

主要承担：

- 游戏主画面
- 游戏世界
- 角色与主要 Gameplay
- 主视觉内容

### 4.2 下屏

Controller 内部的下屏显示面为一个 PlaneGeometry。

对应节点：

```text
Bottom_Display_Plane
```

后续 Three.js 只需要将动态 Texture / RenderTarget 映射到该 Plane。

主要承担：

- 地图
- 背包
- Radar
- 状态信息
- Touch UI
- Secondary Gameplay

原则：

> 上下屏必须承担不同职责，不能简单复制同一游戏画面。

---

## 5. 屏幕实现方式

Duo 不实现真实柔性屏幕。

采用两块独立 Plane：

```text
Top_Screen_Plane
Bottom_Screen_Plane
```

Controller 安装完成后，最终下屏使用：

```text
Bottom_Display_Plane
```

折叠动画过程中保持屏幕关闭，展开完成后再点亮，因此无需表现屏幕在折叠过程中的连续形变。

---

## 6. 网页主要流程

### 6.1 Loading

- 加载 GLB
- 加载 Texture
- 初始化 WebGPU / WebGL Renderer
- 初始化 RenderTarget
- 初始化游戏资源
- Shader / Pipeline 预热

### 6.2 Intro

#### Shot 01 — Folded Duo
展示折叠状态 iPhone Duo，Controller 暂不出现。

#### Shot 02 — Unfold
iPhone Duo 自动展开，折叠过程中屏幕保持黑屏。

#### Shot 03 — Screen Wake
展开完成后，上下屏点亮并显示双屏游戏 UI。

#### Shot 04 — Controller Reveal
Controller 从画面外进入，展示 Controller、Duo Bottom 与滑轨安装关系。

#### Shot 05 — Controller Assembly
Controller 沿滑轨方向完成：

```text
Align
→ Slide
→ Lock
```

安装完成时可加入：

- 微小机械回弹
- Click 音效
- 下屏状态激活

#### Shot 06 — Hero Shot
展示完整 `iPhone Duo + Controller`，形成 NDS / 3DS 风格双屏掌机。

#### Ready
Intro 暂停，显示 `PLAY` 或 `Press Any Key`，等待用户主动进入 Playable Demo。

---

## 7. Playable Demo

进入 Play 状态后：

- Hinge 锁定
- Controller 锁定
- Camera 切换到游戏体验机位
- 产品装配动画停止

核心体验：

```text
Game
+
Dual Screen
+
Input
+
3D Controller Feedback
```

---

## 8. 输入系统

统一使用 InputManager。

支持：

- Keyboard
- Gamepad API
- 后续可扩展 Touch

统一 Action：

```text
MOVE_UP
MOVE_DOWN
MOVE_LEFT
MOVE_RIGHT

ACTION_A
ACTION_B
ACTION_X
ACTION_Y

START
SELECT
```

---

## 9. 3D Controller 反馈

### ABXY
- 按下时按钮轻微下沉
- 松开后回弹

### D-Pad
D-Pad 为整体 Mesh，根据方向产生轻微倾斜。

目标反馈链路：

```text
实体 / 键盘输入
→ 浏览器输入系统
→ 游戏响应
→ 3D Controller 动画
```

---

## 10. 推荐状态机

```text
LOADING
↓
INTRO_FOLDED
↓
INTRO_UNFOLD
↓
SCREEN_WAKE
↓
CONTROLLER_REVEAL
↓
CONTROLLER_ASSEMBLY
↓
HERO
↓
READY
↓
ENTER_PLAY
↓
PLAY
```

---

## 11. 推荐 Intro 时间

| 时间 | 状态 |
|---|---|
| 0–2s | Folded Duo |
| 2–4.5s | Unfold |
| 4.5–5.5s | Screen Wake |
| 5.5–7s | Controller Reveal |
| 7–9s | Controller Assembly |
| 9–11s | Hero Shot |
| 11s+ | Ready |

提供 `Skip Intro`，便于开发调试和重复访问。

---

## 12. Three.js 主要模块

本节保留产品层面的模块概览；具体实现边界以第 23 节为准。

```text
App
│
├─ SceneManager
├─ ModelManager
├─ CameraManager
├─ MaterialManager
├─ IntroDirector
├─ AssemblyController
├─ ScreenManager
├─ InputManager
├─ ControllerAnimator
└─ Game
```

---

## 13. 运行时目标结构（原 Blender 规划）

以下结构最初计划在 Blender 中完成。当前决定是不再修改模型，因此它只作为运行时逻辑结构参考，不代表 `iphone.glb` 的真实节点树。真实节点树见第 17 节，代码生成的 Rig 见第 18 节。

```text
DUO_NDS_ROOT
│
├─ PHONE_ROOT
│  ├─ BottomHalf_NO_CAM
│  │  ├─ Bottom_Frame
│  │  ├─ Bottom_Screen_Back
│  │  └─ Bottom_Screen_Plane
│  │
│  ├─ Hinge_Mesh
│  │
│  └─ Hinge_Pivot
│     └─ TopHalf_CAM
│        ├─ Top_Frame
│        ├─ Top_Screen_Back
│        ├─ Top_Screen_Plane
│        └─ Camera_Module
│
├─ CONTROLLER_ASSEMBLY_ROOT
│  └─ Controller_ROOT
│     ├─ Controller_Shell
│     ├─ Bottom_Display_Plane
│     ├─ DPad
│     └─ Button_Group
│        ├─ Button_A
│        ├─ Button_B
│        ├─ Button_X
│        └─ Button_Y
│
├─ ANCHORS
│  ├─ Controller_Entry
│  ├─ Controller_Installed
│  ├─ NDS_Center
│  └─ Assembly_Target
│
└─ CAMERAS
   ├─ CAM_Folded
   ├─ CAM_Unfold
   ├─ CAM_Assembly
   ├─ CAM_Hero
   └─ CAM_Play
```

---

## 14. 技术栈

- Blender
- Three.js
- WebGL / WebGPU
- glTF / GLB
- GSAP（仅用于 Intro、装配和镜头时间线）
- Keyboard Events
- Gamepad API
- CanvasTexture / RenderTarget
- HTML / CSS / JavaScript

---

## 15. V1 验收标准

```text
打开网页
→ Loading
→ 折叠状态 Duo 出场
→ Duo 展开
→ 双屏点亮
→ Controller 出场
→ Controller 滑轨安装
→ 形成完整 NDS 形态
→ Hero Shot
→ 点击 Play
→ 进入可玩模式
→ Keyboard / Gamepad 控制游戏
→ 3D ABXY / D-Pad 同步响应
→ 上屏实时显示游戏主画面
→ 下屏实时显示副屏内容
```

完成上述链路，即可认为本项目核心概念验证完成。

---

## 16. 当前开发阶段

目前已完成：

- iPhone Duo 基础模型
- Controller 白模
- Controller + Duo 基础组合结构
- 基础材质方向确定
- Controller 滑轨式安装方案确定
- 双屏结构确定
- Intro / Playable Demo 主流程确定
- `Experience` 单例与 Class 组件基础架构
- `Resources` 集中资源声明和 GLB 加载流程
- `ModelAdapter` 必需节点校验、包围盒居中和基础缩放
- WebGPU 初始化、资源加载和失败状态提示
- Camera OrbitControls 与 Tweakpane 基础模型调试
- GLB 中 9 个必需运行时节点的实际存在性校验
- Runtime Rig、`8° / 110° / 180°` 折叠控制和 Controller EXR Lightmap
- Controller Reveal、Align、Slide、Lock 可重播时间线
- Controller 装配采用约 1.85 秒的阶段重叠吸合节奏，并在锁定后保留 Hero 留白
- IntroDirector 基础状态流、Replay Intro、Skip Intro、Ready 与 Play 调试入口
- CameraDirector 四组运行时镜头、Intro 状态映射、Orbit 锁定与 Tweakpane 取景工具

当前下一步：

> Camera Shot 已完成用户视觉校准；下一步实现 Screen Wake 和页面 Ready / Play UI。

---

## 17. 已确认的 GLB 现状

当前 `public/iphone.glb` 对应的 Blender 源文件已经包含完整的手机与控制器视觉资源。模型导出时，手机处于竖屏完全展开状态，控制器与手机的相对位置已经是安装完成后的目标位置。

实际主要层级为：

```text
PHONE_ROOT
├─ BottomHalf_NO_CAM
│  ├─ Bottom_Frame
│  ├─ Bottom_Screen_Back
│  ├─ Bottom_Screen_Plane
│  └─ 平面
├─ Hinge
└─ TopHalf_CAM
   ├─ Camera_Module
   ├─ Top_Frame
   │  └─ apple-logo
   ├─ Top_Screen_Back
   └─ Top_Screen_Plane

CONTROLLER_ASSEMBLY_ROOT
└─ Controller_ROOT
   ├─ Bottom_Display_Plane
   ├─ Button_A
   ├─ Button_B
   ├─ Button_X
   ├─ Button_Y
   ├─ buttons
   ├─ Controller_Shell
   └─ DPad
```

模型当前没有：

- 独立的 `Hinge_Pivot`
- 安装与镜头 Anchor
- 动画 Action
- 可直接使用的产品镜头

这些内容不再回到 Blender 中补建，统一在 Three.js 中生成。

Controller 最终程序化材质仍在后续阶段实现。当前 `Controller_Shell` 使用 `TEXCOORD_1` 烘焙的 `public/lightmaps/Controller_Shell_lightmap.exr` 提供运行时 GI；PNG 文件只用于预览，不作为运行时纹理。

---

## 18. 运行时产品层级

GLB 加载完成后，创建一层不污染原始模型的运行时 Rig：

```text
PresentationRoot                 # 整机位置、旋转、缩放与 Hero 构图
└─ ProductRoot                   # 产品逻辑根节点
   ├─ BottomRig                  # 固定基准
   │  ├─ BottomHalf_NO_CAM
   │  └─ ControllerAssemblyRig
   │     └─ CONTROLLER_ASSEMBLY_ROOT
   ├─ HingePivot                 # 代码根据 Hinge 包围盒创建
   │  └─ TopHalf_CAM
   ├─ HingeVisualRig
   │  └─ Hinge
   └─ RuntimeAnchors
      ├─ ControllerEntry
      ├─ ControllerInstalled
      ├─ ProductCenter
      ├─ CameraHero
      └─ CameraPlay
```

层级原则：

- `BottomRig` 是折叠运动的固定参考系。
- 只旋转 `HingePivot` 下的 `TopHalf_CAM`。
- Controller 安装完成后跟随 `BottomRig`，不跟随上半屏。
- `PresentationRoot` 只负责整机在镜头中的构图，不参与铰链角度计算。
- 重新挂接节点时必须保持世界变换，避免模型跳位。

---

## 19. 折叠与铰链规则

### 19.1 角度定义

使用上下两块屏幕内侧平面的夹角作为产品角度：

```text
0°    = 理论完全闭合
8°    = 入场初始近闭合态，避免模型穿插与 Z-Fighting
90°   = 直角形态
110°  = 当前建议的 Hero / Play 展示态
180°  = GLB 当前竖屏完全展开 Bind Pose
```

GLB 的 Bind Pose 为 `180°`，所以代码中的上半屏折叠旋转量为：

```text
foldRotation = 180° - productAngle
```

示例：

| 产品夹角 | 上半屏相对 Bind Pose 的旋转量 |
|---:|---:|
| 8° | 172° |
| 90° | 90° |
| 110° | 70° |
| 180° | 0° |

入场动画建议从 `8°` 动画到 `110°`。GLB 加载后、首次可见渲染之前就应用 `8°`，避免页面短暂闪现完全展开状态。

### 19.2 Pivot 与旋转轴

- `HingePivot` 的位置由 `Hinge` 网格包围盒中心计算。
- 铰链长轴由 `Hinge` 局部包围盒最长方向推导，不在代码里硬编码 Blender 轴向。
- 旋转正负方向根据上屏法线与下屏法线在首次适配时校准。
- 上半屏重新挂到 `HingePivot` 时保持原世界变换。

### 19.3 铰链外观

铰链不是本项目的重点，不模拟内部机械结构。视觉网格只需要位于上下机身姿态的中间方向：

```text
hingeOrientation = midpoint(bottomOrientation, topOrientation)
```

实现上可使用上下姿态四元数的 `slerp(0.5)`。下半屏固定时，也可理解为铰链视觉旋转量取上半屏折叠量的一半。

入场完成后：

- 产品夹角锁定在目标值。
- 铰链不再逐帧执行复杂求解。
- 后续镜头运动只操作 `PresentationRoot` 或 Camera。

---

## 20. Controller 装配姿态与入场

### 20.1 最终安装位置

Controller 的最终位置已经存在于 GLB 中，不再人工测量或重新设计。

加载模型后应立即记录：

```text
ControllerInstalled = Controller 相对于 BottomRig 的当前变换
```

该变换是装配动画唯一权威终点。即使手机从 `180°` 折到 `110°`，下半屏和 Controller 的相对关系也保持不变。

### 20.2 入场动画

Controller Reveal / Assembly 可以使用以下流程：

```text
读取并保存 ControllerInstalled
→ 将 Controller 临时放到 ControllerEntry
→ Reveal
→ Align
→ Slide
→ 到达 ControllerInstalled
→ 小幅过冲回弹
→ Lock
```

`ControllerEntry` 可以由最终变换沿滑轨方向反推，不需要 Blender Anchor。首版只需在 Tweakpane 暴露：

- 滑轨方向
- 起点距离
- Reveal 时长
- Slide 时长
- Lock 回弹幅度

这些参数视觉确认后固化为默认值。

---

## 21. NDS 游戏方案

### 21.1 当前方向

Playable Demo 优先考虑真正的 NDS 双屏内容，而不是 NES 单屏游戏，也不优先做 3DS 模拟。

原因：

- NDS 原生输出两块 `256 × 192` 画面，与产品双屏概念天然一致。
- D-Pad、ABXY、Start、Select 可以直接映射现有 Controller。
- 下屏触控可以在后续阶段补充，不阻塞首版键盘与手柄操作。
- 浏览器中的 NDS WebAssembly 模拟方案比 3DS 更轻、更成熟。

3DS 模拟暂不作为 V1 目标，主要风险是浏览器性能、启动资源、兼容性和集成复杂度。

### 21.2 模拟器候选

首选验证候选：

- [Desmond](https://github.com/js-emulators/desmond)：可嵌入网页的 DeSmuME WebAssembly 封装，支持通过 Web Component 加载 `.nds`。

备选：

- [dust](https://github.com/kelpsyberry/dust)：Rust 编写、包含 Web 前端的 NDS 模拟器，许可为 GPL-3.0，现代但嵌入改造成本可能更高。
- [EmulatorJS 的 Nintendo DS 支持](https://emulatorjs.org/docs/systems/nintendo-ds/)：可使用 melonDS Core，集成完整，但 UI 和内部输出管线可能需要较多裁剪。

正式选型前必须完成一个最小技术验证：

1. 在本地加载可合法分发的 Homebrew `.nds`。
2. 确认模拟器能稳定运行并响应键盘输入。
3. 找到上下屏画面的 Canvas 或帧缓冲输出。
4. 将上下屏分别复制到两个独立 Canvas。
5. 把两个 Canvas 转成 Three.js `CanvasTexture`。
6. 分别映射到 `Top_Screen_Plane` 与 `Bottom_Display_Plane`。
7. 验证音频必须由用户点击 `Play` 后启动，满足浏览器自动播放策略。

### 21.3 屏幕桥接

建议由 `NDSScreenBridge` 隔离模拟器与 Three.js：

```text
NDS Emulator
├─ Top Frame 256 × 192
└─ Bottom Frame 256 × 192
        ↓
NDSScreenBridge
├─ topCanvas    → topTexture    → Top_Screen_Plane
└─ bottomCanvas → bottomTexture → Bottom_Display_Plane
```

如果模拟器只提供一张纵向拼接画布，则每帧分别裁切上半区和下半区；如果提供两张画布，则直接作为两个纹理源。该差异只允许存在于 `NDSScreenBridge` 内，不能扩散到场景代码。

### 21.4 开源游戏选择原则

优先使用：

- 原创 IP 的 NDS Homebrew。
- 明确包含开源许可证和可分发构建产物的项目。
- 双屏分工明显、无需触控也可完成基本操作的游戏。
- 画面具有辨识度，进入后数秒内能看出可玩性。

候选方向：

- `Trail Mix`：NDS 原生的 auto-chess / roguelike shooter，内容和画面更适合作为展示，已声明 MIT；仍需核实正式源码地址、资源许可和 ROM 再分发条款。
- [Pong-NDS](https://github.com/Chi-Iroh/Pong-NDS)：MIT，结构简单、适合最早完成模拟器与双屏管线验证，但视觉表现较弱。
- `Traffic Escape DS`：双屏益智方向，需进一步核实源码、许可证和浏览器模拟器兼容性。

不建议直接用于公开产品展示：

- 商业 NDS ROM。
- 使用任天堂角色或其他商业影视、游戏 IP 的复刻项目。
- 只有代码开源、但美术与音乐没有明确再分发许可的 Homebrew。

模拟器开源不代表游戏 ROM 可以分发。最终上线前必须分别确认模拟器许可证、游戏源码许可证、游戏资源许可证和预编译 ROM 的再分发权限。

---

## 22. 动画技术选择

### 22.1 使用 GSAP

GSAP 只负责离散且有明确起止时间的展示动画：

- Intro 时间线
- 手机从近闭合态展开到目标夹角
- Controller Reveal / Align / Slide / Lock
- Camera Shot 切换
- UI 淡入淡出

### 22.2 不使用 GSAP

ABXY 与 D-Pad 的实时反馈不使用 GSAP Timeline，改为渲染循环中的阻尼弹簧：

```text
Input Target
→ Spring / Damping
→ Button Position 或 DPad Tilt
```

这样可以自然处理中途松开、快速连按、同时按键和 Gamepad 高频输入，避免多个 Tween 相互覆盖。

---

## 23. 推荐代码模块

```text
App
├─ Renderer
├─ ProductRig
│  ├─ ModelAdapter              # 校验节点、建立运行时层级
│  ├─ HingeController           # 产品夹角、Pivot、铰链视觉
│  └─ ControllerAssembly        # 保存安装终点、执行装配动画
├─ IntroDirector                # 状态机和 GSAP 时间线
├─ CameraDirector               # Hero / Play 等镜头
├─ ScreenManager
│  └─ NDSScreenBridge           # 模拟器输出与双 CanvasTexture
├─ InputManager                 # Keyboard / Gamepad / Touch Action
├─ ControllerFeedback           # 按键弹簧与 D-Pad 倾斜
├─ NDSRuntime                   # 模拟器生命周期、ROM、音频、存档
└─ DebugPane                    # Tweakpane
```

关键边界：

- 场景代码不能依赖具体模拟器 DOM 结构。
- 输入系统只输出语义 Action，不直接操作按钮 Mesh 或模拟器键码。
- GLB 节点名只允许集中在 `ModelAdapter` 中解析。
- Intro 与 Play 的状态切换不能直接散落在渲染循环中。

---

## 24. 当前已确认与待确认事项

### 已确认

- Blender / GLB 不再继续修改。
- 手机 Bind Pose 是 `180°` 的竖屏完全展开态。
- 下半屏固定，上半屏围绕代码生成的 Pivot 旋转。
- 当前目标产品夹角暂定 `110°`，对应上半屏旋转 `70°`。
- 铰链外观采用上下姿态中间值，不制作复杂机械动画。
- Controller 当前 GLB 相对位置就是最终装配位置。
- Controller 跟随下半屏，折叠时不单独重新定位。
- GSAP 用于 Intro 与镜头，不用于按键回弹。
- Playable Demo 方向是 NDS 双屏内容，不是 NES。
- 不需要用户在开发阶段逐项验收，由用户最后进行视觉验收。
- 后续静态资源由用户自行补充，工程保持 `public` 为公共资源目录。
- Controller Shell 的运行时 GI 使用 2048 × 2048 Half Float EXR Lightmap，并通过 `TEXCOORD_1` 采样。

### 待技术验证

- 最终采用 Desmond、dust 或其他 NDS Web 模拟方案。
- 选定 Homebrew 游戏及其完整许可证链路。
- 模拟器上下屏帧缓冲的具体获取方式。
- NDS 音频、存档和 ROM 加载在目标浏览器中的兼容性。
- WebGPU 渲染循环与模拟器 Canvas 更新频率的性能预算。

### 待视觉微调

- Hero / Play 最终镜头。
- 产品夹角是否从 `110°` 微调。
- Controller 入场方向、距离和回弹幅度。
- 按键下沉深度与 D-Pad 最大倾角。

---

## 25. 分阶段实施顺序

### Phase 1 — Model Adapter

目标：让代码稳定识别现有 GLB，不做展示动画。

- 加载 `public/iphone.glb`。
- 校验所有必需节点名。
- 输出缺失节点的明确错误，而不是静默失败。
- 记录原始父子关系、局部变换和世界变换。
- 计算模型整体包围盒与产品中心。
- 将材质、阴影、色彩空间调整到基础可用状态。

完成条件：模型首次渲染时位置正确，没有跳位、缩放异常或材质丢失。

### Phase 2 — Runtime Rig 与折叠

目标：不修改 Blender 的前提下完成折叠控制。

- 创建 `PresentationRoot`、`BottomRig`、`HingePivot` 和 `HingeVisualRig`。
- 从 `Hinge` 包围盒推导 Pivot 与长轴。
- 保持世界变换地重新挂接上半屏。
- 用 Tweakpane 实时调节产品夹角。
- 验证 `8° → 110° → 180°` 全范围没有穿插、翻转或漂移。

完成条件：角度公式稳定，页面首次显示时不会闪现 Bind Pose。

### Phase 3 — Controller 装配

目标：使用 GLB 当前相对姿态作为唯一装配终点。

- 保存 `ControllerInstalled`。
- 从终点沿可调滑轨方向生成 `ControllerEntry`。
- 实现 Reveal、Align、Slide、Lock。
- Lock 后将 Controller 固定到 `BottomRig`。

完成条件：动画结束后的变换与 GLB 原始装配姿态一致。

### Phase 4 — Intro 与镜头

目标：完成从产品介绍到可玩状态的整条时间线。

- 接入 GSAP。
- 实现 Intro 状态机与 Skip Intro。
- 建立 Folded、Assembly、Hero、Play 镜头。
- 屏幕点亮发生在折叠完成后。
- `READY` 状态等待用户操作，用户点击后再启动音频与游戏。

完成条件：Intro 可重复播放、可跳过，状态切换无竞态。

### Phase 5 — NDS 技术验证

目标：先证明模拟器能够作为纹理源，再决定正式依赖。

- 在隔离页面运行模拟器与 Homebrew ROM。
- 测量首屏加载时间、帧率、内存和音频稳定性。
- 完成上下屏 Canvas 提取。
- 在 3D 模型两块屏幕上显示真实模拟器画面。
- 验证页面隐藏、恢复、失焦和窗口尺寸变化。

完成条件：连续运行十分钟无明显音画漂移、崩溃或输入卡死。

### Phase 6 — 输入与产品反馈

目标：让同一份 Action 同时驱动游戏和 3D 控制器。

- Keyboard 与 Gamepad 归一化。
- Action 转换为模拟器按键。
- Action 同时驱动 ABXY 弹簧和 D-Pad 倾斜。
- 处理连按、组合键、失焦后卡键和手柄断开。

完成条件：画面响应和 3D 按键反馈在主观上同步。

### Phase 7 — 产品化收尾

- Loading 与错误提示。
- 移动端降级策略。
- 首次访问音频授权提示。
- ROM、模拟器与第三方资源许可展示。
- 性能档位与低性能设备降级。
- 最终由用户完成视觉验收。

---

## 26. 风险与降级方案

| 风险 | 影响 | 首选处理 | 降级方案 |
|---|---|---|---|
| 模拟器无法暴露上下屏像素 | 无法映射到 3D 屏幕 | 在模拟器渲染层增加输出适配 | 读取合并 Canvas 后裁切 |
| 模拟器与 WebGPU 同时运行负载过高 | 掉帧、发热 | 降低 3D DPR、阴影和后处理 | 3D 30 FPS，模拟器保持原帧率 |
| CanvasTexture 每帧上传成本过高 | GPU 带宽压力 | 仅在新模拟器帧到达时标记更新 | 降低纹理过滤或更新频率 |
| Homebrew ROM 许可不完整 | 无法公开部署 | 更换为许可链完整的原创 Homebrew | 自制最小 NDS Homebrew 验证 ROM |
| 模拟器 GPL 等许可与发布方式冲突 | 影响分发方案 | 在选型 Spike 阶段完成许可证审核 | 更换兼容许可的模拟器或隔离部署 |
| GLB 节点名发生变化 | 运行时 Rig 失效 | `ModelAdapter` 启动时完整校验 | 提供集中式节点映射表 |
| 自动播放策略阻止音频 | 首次进入无声 | 用户点击 Play 后创建 / 恢复 AudioContext | 显示明确的启用声音按钮 |
| Gamepad 映射差异 | 不同手柄按键错位 | 采用标准映射并提供调试视图 | Tweakpane 中允许临时重映射 |
| 3DS 路线性能不足 | 延期且体验不稳定 | V1 明确使用 NDS | 3DS 仅作为后续独立技术研究 |

如果 NDS 模拟器路线在技术验证阶段失败，产品结构和输入模块仍可复用。届时只替换 `NDSRuntime + NDSScreenBridge`，接入一个 NDS 视觉风格的 Web 双屏小游戏；该方案是降级路径，不是当前首选。

---

## 27. Tweakpane 调试项

Tweakpane 只用于开发调试，生产构建默认隐藏。

### Product

- `productAngle`
- `foldedAngle`
- `playAngle`
- `hingeAxisSign`
- `hingeVisualMix`
- `productScale`
- `productRotation`

### Controller Assembly

- `entryDistance`
- `slideDirectionX/Y/Z`
- `revealDuration`
- `alignDuration`
- `slideDuration`
- `lockOvershoot`

### Button Feedback

- `buttonTravel`
- `buttonStiffness`
- `buttonDamping`
- `dpadMaxTilt`
- `dpadStiffness`
- `dpadDamping`

### Camera

- Hero Camera position / target / FOV
- Play Camera position / target / FOV
- Dolly duration
- Orbit debug enable

### Screen / Performance

- 屏幕亮度与发光强度
- CanvasTexture 更新频率
- Renderer DPR
- Shadow enable
- Debug screen source preview

### State Debug

- 当前 Intro State
- Skip Intro
- Replay Intro
- Enter Play
- Pause / Resume NDS Runtime
- 模拟 Keyboard / Gamepad Action

### Coordinate Inspector

- 世界原点坐标轴与 XZ 网格
- 红 X、绿 Y、蓝 Z 轴向图例
- PresentationRoot 与关键 GLB 节点选择
- 所选节点局部坐标轴与世界包围盒
- 全部关键部件坐标轴开关
- 局部 / 世界 Position 与 Rotation 实时只读值

---

## 28. 核心计算参考

### 28.1 产品角度

```ts
const bindAngle = Math.PI
const productAngle = THREE.MathUtils.degToRad(params.productAngle)
const foldRotation = bindAngle - productAngle

hingePivot.quaternion.setFromAxisAngle(hingeAxis, hingeAxisSign * foldRotation)
```

这里的 `hingeAxis` 必须来自模型适配结果，不能假定永远是世界坐标的 X、Y 或 Z。

### 28.2 保持世界变换重新挂接

```ts
scene.updateMatrixWorld(true)
hingePivot.attach(topHalf)
bottomRig.attach(bottomHalf)
bottomRig.attach(controllerAssembly)
scene.updateMatrixWorld(true)
```

`Object3D.attach()` 用于在更换父节点时保持对象世界变换。建立 Rig 前后仍需检查对象是否包含非均匀缩放；若存在，应该先在适配层消除或单独处理。

### 28.3 保存 Controller 安装终点

```ts
bottomRig.updateWorldMatrix(true, false)
controllerAssembly.updateWorldMatrix(true, false)

const controllerInstalledMatrix = bottomRig.matrixWorld
  .clone()
  .invert()
  .multiply(controllerAssembly.matrixWorld)
```

装配动画结束时使用该矩阵分解出的 Position、Quaternion、Scale 作为终点，不通过肉眼重新填写一套坐标。

### 28.4 铰链视觉中间姿态

```ts
hingeVisual.quaternion.slerpQuaternions(
  bottomWorldQuaternion,
  topWorldQuaternion,
  params.hingeVisualMix, // 默认 0.5
)
```

如果铰链网格自身局部轴与机身法线不一致，需要在 `ModelAdapter` 中保存一个固定的 Bind Pose 修正四元数。

### 28.5 按键弹簧

每个按钮只保存当前位置、速度和目标值：

```ts
velocity += (target - value) * stiffness * dt
velocity *= Math.exp(-damping * dt)
value += velocity * dt
```

`target` 在按下时为 `1`，松开时为 `0`。最终位移为 `-pressAxis * buttonTravel * value`。D-Pad 使用同一套弹簧值驱动两个倾斜轴。
