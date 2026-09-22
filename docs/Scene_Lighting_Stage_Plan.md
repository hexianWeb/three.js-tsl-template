# 场景环境、展台、GI 与 AO 实施计划

> 2026-09-22（决定变更 · 重要）：**HDR 环境贴图方案取消。** 用户实测接入 `scene.environment` 后整体观感更差，决定不设置环境贴图。A 里程碑的 HDR 部分作废，第 3 节 A 已改写为"展台 + 灯光 + 主光阴影"。该决定的连带影响见第 2 节"取消 HDR 的后果"。
> 2026-09-22（决定变更）：展台恢复为**程序化倒角桌板占位**。此前"改为用户导入的外部模型"的决定暂缓——外部模型尚未提供，先用占位件验收接触阴影与构图，外部模型到位后再替换 `Stage.js` 的几何来源。
> 2026-09-22（已实施）：`World/Environment/Environment.js` 与 `World/Environment/Stage.js` 已建立，A 里程碑（不含已取消的 HDR）完成，详见第 7 节。
> 2026-09-22（复核）：`src/js/Core/ScenePipeline.js` 仍不存在，B（GTAO）**未进入源码**；此前把它写成已完成的记录不成立。
> 材质基线提交：`a7a141d`（Controller 磨砂外壳与按键清漆材质）。

## 1. 用户已确认

- Phase 4 视觉流程已完成；进入 Phase 5 前先完善产品棚拍环境。
- **不使用 HDR 环境贴图**。`studio_small_03_1k.hdr` 已实测接入并被否决，文件保留在 `public/hdr/` 但不进入 `sources.js`。重新提起该方案前先读第 2 节"取消 HDR 的后果"。
- 桌面上表面位于 **Blender Z = -0.035**，不是 Three.js 世界 Z。
- 展台选用 **哑光、低反光、薄倒角桌板**；实际调定为暖灰 `#a79f92`。
- 仍希望评估 LightProbeGrid 与 GTAO，利用接触阴影与间接光改善材质层次。

## 2. 当前基线及问题

以下为实施前基线；当前实现和验证结果见第 7 节。

- `World` 使用 HemisphereLight 2.4、Directional 主光 5、蓝色 Directional 补光 2，不设置 `scene.environment`。
- `Renderer` 使用 WebGPURenderer、ACES、曝光 1.1、2048 主光阴影和 PCFShadowMap；当前直接 render，没有后处理管线。
- 外壳使用独立 EXR Lightmap，按键使用 Physical 清漆。
- EXR 是既有烘焙结果，不包含桌板的反弹光。保留该基线，提供开关对比，不能宣称桌板 GI 已被它覆盖。

### 取消 HDR 的后果

HDR 被否决的原因是实测观感更差：外壳 EXR Lightmap 本身就是一次天光烘焙，叠加 studio HDR 后重复计光，整体被抬平、层次反而减少。这个结论要连带记住三件事，否则后面的判断会站在错误前提上。

- **间接镜面为零**。`HemisphereLight` 在 three 中只贡献 irradiance，不产生镜面反射。没有 `scene.environment` 就没有任何 IBL specular，按键清漆只能从两盏 `DirectionalLight` 得到点状高光，**拿不到柔光箱轮廓**。第 6 节的验收标准已按此改写。
- **间接漫反射完全无方向**。场景唯一的环境光是半球光，凹缝与开阔面收到的间接光几乎一样，这正是最容易把细节洗平的照明。GTAO 是当前唯一能压住它的手段，因此**取消 HDR 让 B 的必要性上升，而不是下降**。
- **Lightmap 的地位反而上升**。原先计划在 HDR 到位后重估这张图的去留（因为与环境光重复）。HDR 取消后重复计光的问题消失，它成了外壳唯一的方向性间接光来源，默认保留 `lightMapIntensity = 1`。

### Controller Shell Lightmap 的实际内容与作用范围

这一条是后续 A/B 决策的前提，先与预览图和 three.js 实现对齐，避免把它当成"外壳已经有 AO"。

- **覆盖范围**：Lightmap 只在 `ModelAdapter.configureControllerLightmap()` 里贴到 `Controller_Shell` 单个 Mesh。ABXY / DPad 按键、手机上下半身、`Hinge` 与外部展台模型都没有任何烘焙遮蔽。
- **烘焙内容**：`Controller_Shell_lightmap_preview.png` 呈现的是一次天光方向性 irradiance——顶面接近纯白，侧壁与底面按朝向渐变，仅 DPad / ABXY 孔沿有轻微边缘变暗。它与当前 `HemisphereLight(2.4)` 高度重合，**局部遮蔽成分很少**。
- **注入通道是加法**：`MeshStandardNodeMaterial.setupLightMap()` 走 `IrradianceNode(materialLightMap)`，即 `irradiance += lightMap.rgb * lightMapIntensity`。它只能额外加光，无法压低 `HemisphereLight` 在凹缝中的贡献。
- **静态**：贴图固定在物体空间，无法表达 Controller 装配位移、8°–110° 折叠、以及产品与桌面之间逐帧变化的遮蔽关系。

## 3. 推荐顺序

### A. 展台 + 灯光 + 主光阴影（已完成）

原计划的第 1、2 项（`sources.js` 声明 HDR、设置 `scene.environment`）**已取消**，理由见第 2 节。其余项的落地状态：

1. ~~通过 `sources.js` 声明 HDR URL，`Resources` 增加 `HDRLoader` 类型。~~ 已取消。
2. ~~HDR 设置 EquirectangularReflectionMapping，由 PMREM 生成粗糙度相关反射。~~ 已取消。背景仍由 `scene.background` 独立管理。
3. ✅ `World.setEnvironment()` 已拆为 `World/Environment/Environment.js`，暴露背景、曝光、三盏灯强度、主光位置与阴影参数。
4. ⚠️ 清漆与金属高光只能来自两盏 `DirectionalLight`，没有环境反射可用。若后续认为高光过于单薄，替代方案是加低强度 `RectAreaLight` 做柔光箱塑形——这是**唯一**不引入 IBL 又能造出面光源高光的路径，但它不作为承影光源。
5. ✅ 灯光能量保持基线（Hemisphere 2.4 / Key 5 / Fill 2 / 曝光 1.1）。取消 HDR 后不存在重复计光，`lightMapIntensity` 保持 1，无需下调。
6. ✅ Stage 使用 `RoundedBoxGeometry` + 非金属 `MeshStandardNodeMaterial`，roughness 调定 0.72。
7. ✅ 主光阴影相机范围与 near/far 已按光源距离收紧。PCF radius、bias、normalBias 仍是默认值，留待接触漂浮或条纹出现时再调。
8. ⚠️ `showKeyLightHelper` 默认仍是 `true`。生产前应改为默认隐藏，Tweakpane 开关已具备。

### B. GTAO（第二个可验收里程碑）

**目标定义**：GTAO 负责的是"产品与展台的接触遮蔽"和"按键 / 孔洞 / 铰链 / 装配缝的近场遮蔽"。它**不是**为外壳补 AO——外壳已有烘焙，但那份烘焙既不覆盖其它部件，也不覆盖动态遮蔽（见第 2 节）。

**取消 HDR 后优先级上升**：场景现在唯一的间接漫反射是 `HemisphereLight(2.4)`，完全无方向，凹缝与开阔面收到的间接光几乎相同。AO 是当前唯一能对它做空间调制的手段，因此 B 从"锦上添花"变成**产品层次的主要来源**。

**为什么 Lightmap 不能替代它**：覆盖面只有一个 Mesh；注入通道是加法 irradiance，压不住半球光；预览图里几乎没有局部遮蔽成分；且无法表达装配与折叠带来的动态遮蔽。反过来说，GTAO 也不能替代 Lightmap：AO 是灰度衰减，给不出烘焙里的方向性与色温。两者互补，各自保留独立开关。

**与 Lightmap 共存的约束**：`PhysicalLightingModel` 把 AO 乘到整个 `indirectDiffuse`，其中已经包含 lightMap 的加法贡献。孔沿区域会同时吃到烘焙暗与 GTAO 暗。调参顺序固定为：先关 Lightmap 定 AO strength / radius，再开 Lightmap 复核孔沿是否叠成黑缝，只在复核阶段回调 `lightMapIntensity`，不要反过来靠降 AO 去救。

原先"A 完成后重估 Lightmap 去留"的决策点**已关闭**：那个决策的前提是 HDR 带来重复计光，HDR 取消后前提不成立，Lightmap 默认保留在 `lightMapIntensity = 1`。

- 使用已安装的 `three/addons/tsl/display/GTAONode.js`，不引入 WebGL GTAOPass / EffectComposer。
- 新建 `Core/ScenePipeline.js` 承载后处理，按官方节点示例建立深度/法线预通道，通过 `builtinAOContext` 接入主场景光照。
- 不将 AO 直接乘到最终颜色：屏幕自发光、背景和直射高光不应被统一压黑。间接高光可受材质模型的遮蔽处理影响。
- AO 输入优先使用几何法线，避免把程序化塑料微凹凸误判为宏观遮挡。
- 首轮从半分辨率、16 samples、小半径和边缘保持降噪开始；radius / thickness 按归一化模型尺寸调节，不照抄大型建筑场景参数。
- 首轮不默认开启时间累积。当前 GTAO 的 temporal 模式需要 TRAA，需同时处理镜头瞬切、Replay、Skip、折叠与透明屏幕转场的历史失效和拖影。
- 重点检查 DPad/ABXY 底部、外壳与桌板接触区、铰链与镂空。前三处 Lightmap 完全没有覆盖，是 GTAO 收益最明确的区域；孔沿是唯一与 Lightmap 重叠的区域，按上面的调参顺序复核。
- GTAO 只提供屏幕空间遮蔽，不能替代真实投影或 GI。屏幕边缘、离屏物体、透明层的限制必须通过运动验收。
- ScenePipeline、预通道、AO 和降噪节点接入 Renderer 的 resize / destroy；颜色输出保持一次 tone mapping / 色彩转换。

### C. LightProbeGrid 对照实验（有收益再保留）

当前版本已经提供 WebGPU `LightProbeGrid`，无需额外安装 GI 包，但不能把它理解成自动更新的动态 GI。

- 网格存储 L2 球谐漫反射辐照度，**不提供任何镜面反射**。取消 HDR 后场景已经没有 IBL specular，Grid 补不上这一块，不要指望它改善清漆高光。
- bake 按每个探针六面渲染，再在 GPU 投影和打包。以 4 × 2 × 4 为初始实验规模，每次 pass 至少 192 个场景面捕获；不能每帧重烘焙。
- 首轮只捕获静态桌板/环境，排除动态产品、屏幕与调试辅助物。这样动态产品可以采样稳定环境反弹，但不会得到产品自身动态蓝色溢色或自遮挡；后二者不能伪称已实现。
- 烘焙需要在 WebGPU、资源、Stage 和灯光准备后进行，进入 Intro 前完成或分批处理；分批支持 start/count/pass，但要测启动开销。
- 探针放在桌面以上，避开实体内部；控制采样 near/far。当前网格使用位置插值和法线偏移，没有完整的动态可见性求解，薄壳附近可能漏光。
- 默认 `falloff = 0` 会在体积外以夹取坐标继续贡献光照，实验时明确设置覆盖范围与边界衰减。
- **避免重复计光**：Grid 增加漫反射，半球光和外壳 EXR 也在加漫反射。三者不能默认强度同时堆叠再用曝光掩盖过亮。HDR 已取消，所以这里只需平衡这三项。
- 捕获环境时注意 `scene.background` 和 `scene.environment` 是不同输入。取消 HDR 后 `scene.environment` 恒为 null，深色展示背景 `#090d14` 是纯背景色——**不要把它当环境天空捕获成辐照度**，否则整机会被烘上一层暗蓝。
- 更改灯光或 Stage 后标记烘焙失效，提供显式 Re-bake，不在滑块拖动的每个事件中整网格重烘焙。
- 原 EXR 的烘焙条件未知，因此混合效果必须 A/B 比较；若成本或色彩收益不明显，保留 A+B 作为生产基线。

### 暂不作为首选的方案

- **SSGI**：适合评估动态产品向桌板的彩色反弹，但受离屏缺失、运动噪声、屏幕亮度和时间重投影影响。当前已有 SSGINode 可试验，不建议与 GTAO 一开始全部叠加。
- **VXGI**：当前 addon 支持动态灯光，但动态几何需要重新体素化，对每帧折叠/装配不理想；相比此单产品棚拍的近期目标成本偏高。
- 目标不是效果数量最多，而是按键高光干净、外壳有柔和层次、产品有接触感且手机 UI 清晰稳定。

## 4. Stage 坐标与几何约束

已解析当前 GLB 的节点矩阵和 POSITION accessor bounds：

- GLB 下半屏平行 XZ 平面，竖直轴是 Y。
- Controller Shell 原始 Y 最低点约 `-0.03335412`。
- 用户确认的 Blender Z 高度按导出坐标转换为 GLB Y `-0.035`。
- 当前 `fitScale ≈ 3.9996331`，Bind Pose 整机包围盒中心 Y `≈ -0.01068276`。
- 当前默认展示变换下，桌面世界高度约为：

```text
worldY = (-0.035 - (-0.01068276)) × 3.9996331
       ≈ -0.09726
```

实现必须基于运行时中心/矩阵转换，**不能把上述近似数值写死**。`-0.035` 指上表面，不是桌板几何中心；厚度向下延伸。

- Stage 不参加产品 `fitModel()` 包围盒计算，否则会改变整机缩放和已验收镜头。
- Stage 不挂在折叠 Pivot 或 Controller 装配节点下；以独立舞台根节点管理。
- 宽深根据 Hero 安装态足迹、当前四组镜头及入场路径计算并开放调参。
- 固定桌面与外壳最低点目前仍有很小间隙；Folded 时 Controller 隐藏，裸手机底部高度又不同。因此需全流程检查承托感，不假定一个高度能让两者始终同时贴桌。
- 验收折叠扫掠、Controller Entry/Reveal/Slide/Lock/过冲和桌板的穿插关系。若需修改产品高度/安装姿态，先确认产品动画决策，不擅自破坏已校验的安装矩阵。

## 5. 建议模块边界

```text
World/
  Environment/
    Environment.js        # 已建立：背景、三盏灯、主光阴影、曝光调参与销毁；不设置 scene.environment
    Stage.js              # 已建立：程序化倒角桌板占位，外部模型到位后替换几何来源
    ProbeLighting.js      # 尚未创建；可选探针实验、失效/重烘焙与资源管理
Core/
  Renderer.js             # 唯一渲染循环入口
  ScenePipeline.js        # 尚未创建；主通道、GTAO、降噪与输出
```

此目录仅为计划，开始对应功能时才创建文件。World 显式装配和销毁，资源路径仍只写在 sources.js；不增加新的独立动画循环。

后处理封装采用 `Core/ScenePipeline.js` 命名，避免与 Three.js 自带的 RenderPipeline 混淆。

## 6. 验收与性能决策

1. A/B 对比：无桌板基线、当前 Stage 版本、再加 GTAO、再加 Grid。HDR 分支已否决，不再纳入对比。
2. 完整播放 Fold → Assembly → Hero → Ready → Playing；检查 Replay、Skip 和返回。
3. 屏幕清晰度与亮度稳定；AO 不污染 UI 或在透明转场中形成黑边。
4. 清漆高光干净、无多重重影，外壳保留蓝色和细颗粒，桌板不抢主体。**"读出柔光箱轮廓"已作废**——取消 HDR 后没有 IBL specular，面光源轮廓只能靠 `RectAreaLight` 才能造出，目前未采用。
5. 阴影与承托自然，无明显漂浮、穿插、黑边或重影。
6. 记录目标设备、视口、DPR、帧耗时与启动/烘焙耗时；性能目标先以桌面 60 FPS 为候选，按真实设备测量再决定采样档位，不能凭构建通过宣称实时性能达标。
7. 独立开关 AO、Grid、Lightmap，支持诊断重复照明。
8. 每个实施里程碑运行构建和相应节点/生命周期检查；最终 WebGPU 视觉验收由用户完成。

## 7. 当前源码事实

本节只记录仓库里可以直接验证的状态，不记录已回滚的尝试。

### 渲染与光照

- `Core/Renderer.js`：`WebGPURenderer`（antialias），ACES，曝光 1.1，`shadowMap.enabled = true`，`PCFShadowMap`。`update()` 直接 `instance.render(scene, camera)`，**没有任何后处理管线**。新增 `setExposure()` 作为曝光的唯一公开入口。
- `World/Environment/Environment.js`：从 `World.setEnvironment()` 抽出，持有背景色、`HemisphereLight('#f7fbff', '#101827', 2.4)`、主 `DirectionalLight('#ffffff', 5)`（castShadow，2048² 阴影）与 `DirectionalLight('#7dd3fc', 2)` 补光，以及 Helper、Tweakpane `Environment` folder 和完整销毁路径。
- 主光阴影相机不再使用默认的 ±5 / near 0.5 / far 500。`applyShadowSettings()` 以光源到原点的距离为中心推导 near/far，正交范围由 `shadowExtent`（默认 3.6）控制，`shadowDepth`（默认 6）控制深度区间。
- **`scene.environment` 恒为 null**（设计决定，非待办）。`sources.js` 无 HDR 条目，`Resources` 无 `HDRLoader` 类型。`public/hdr/studio_small_03_1k.hdr` 保留在磁盘上但不被加载。取消理由与连带影响写在 `Environment.js` 顶部注释与第 2 节。
- 间接漫反射来源只有半球光、蓝色补光，以及 `Controller_Shell` 的 EXR Lightmap。**间接镜面为零**。

### 展台

- `World/Environment/Stage.js`：`RoundedBoxGeometry` + `MeshStandardNodeMaterial`（`#a79f92`，roughness 0.72，metalness 0），调定 20 × 20 × 0.12，倒角 0.02。`castShadow = false`、`receiveShadow = true`，直接挂在 Scene 下，不进入 `fitModel()` 包围盒。
- 20 × 20 是 Tweakpane `width` / `depth` 滑杆的上限值。若还需要更大的桌面，要先放宽 `Stage.debugInit()` 里的 `ranges` 上限。
- 桌面高度来自 `ModelAdapter.getStageSurfaceWorldY()`：以 `STAGE_SURFACE_MODEL_Y = -0.035` 经 `model.localToWorld()` 运行时换算，未写死世界坐标。Box 以几何中心为原点，因此摆放时减去半厚度。
- Tweakpane `Stage` folder 提供 visible / color / roughness / width / depth / thickness / bevel / surfaceOffset；改动尺寸会 dispose 旧 geometry 后重建。
- 这是**占位件**。外部展台模型到位后只需替换几何来源，坐标换算与调参接口不变。

### Lightmap

- `sources.js` 声明 `controllerShellLightmap` → `/lightmaps/Controller_Shell_lightmap.exr`（文件存在）。
- `ModelAdapter.configureControllerLightmap()` 校验 `uv1` 后设置 `colorSpace = LinearSRGBColorSpace`、`flipY = true`、`channel = 1`，并写入 `Controller_Shell` 材质的 `lightMap` / `lightMapIntensity = 1`。
- Tweakpane 已有 Product Model → Controller Lightmap 的 Enabled 与 Intensity（0–5）开关，可直接用于 A/B 对比。

### 已执行检查

| 检查 | 结果 |
|---|---|
| `npm run build` | 49 modules，通过；保留已有大 Chunk 提示 |
| Chrome / WebGPU 运行 | 初始化成功，Intro 进入 110° hero，桌板与主光投影可见，无 JS 错误 |
| 运行时高度换算 | `getStageSurfaceWorldY()` 返回 `-0.09726002`，`fitScale = 3.99963311`，与第 4 节推导值一致 |
| 折叠扫掠净空 | 8° / 40° / 80° / 110° 下整机最低点恒为桌面上方 `+0.00658`（最低点是 Controller Shell，不随铰链移动） |

已知问题：Bind Pose 180° 时整机最低点落到桌面下方 `-0.04463`，即上半屏摊平后穿过桌板。180° 只是 Tweakpane 的调试姿态，Intro 与 Hero 都不会到达，暂不处理；若之后要在 180° 做展示，需要抬高产品或下沉桌板。

尚未验收的点：Controller Entry/Slide/Lock 全程与桌板的穿插关系、四组镜头下的桌板构图、收紧后的阴影相机是否裁切到桌板边缘、`ModelInspector` 的 GridHelper 位于 y = 0 会浮在桌面之上遮挡 LookDev 视图。

### 待办

1. **B（GTAO）** — 当前优先级最高。取消 HDR 后半球光是唯一的间接漫反射且完全无方向，AO 是产品层次的主要来源。目标与约束见第 3 节 B。
2. **C（LightProbeGrid 对照）**，有收益再保留。
3. 生产前把 `showKeyLightHelper` 默认值改为 `false`。
4. 若清漆高光在验收中显得单薄，评估低强度 `RectAreaLight`——这是不引入 IBL 时唯一能造出面光源高光的路径。

已关闭的条目：A 的 HDR 部分（否决）、Lightmap 去留决策（前提消失，保留 `lightMapIntensity = 1`）。
