# WebGPU SSGI 真实感渲染管线改造 — 设计稿

- 日期：2026-05-06
- 范围：`three.js-tsl-template` 模板项目
- 目标：在保留 `WebGPURenderer + TSL` 技术栈的前提下，引入 SSGI（屏幕空间全局光照）+ AO + TRAA，并补齐 PBR 真实感所需的 IBL / 阴影 / Tonemapping 地基，让起重机 GLB 模型呈现工业品展示级别的视觉质量。

## 1. 背景与决策

### 1.1 当前现状

- Three.js r183 + `three/webgpu` + TSL 节点系统
- 渲染管线：`new RenderPipeline(renderer, pass(scene, camera))`，单输出，无后处理
- 光照：`HemisphereLight` + `DirectionalLight`（无阴影）
- 场景无 IBL、无 tonemapping
- 资源加载支持 RGBELoader（已具备）
- 调试 UI：tweakpane（自封 `Debug` 类）

### 1.2 用户决策（脑暴对齐）

| 议题 | 选择 |
|---|---|
| 渲染器栈 | **保留 WebGPU/TSL**（不切回 WebGL） |
| 改造范围 | **管线 + 真实感地基**（不做整模型材质审计） |
| IBL 来源 | **室内 studio HDRI 文件**（厂房设备语境） |
| 性能档位 | **平衡档**：sliceCount=2 / stepCount=12 / pixelRatio cap=1 |

### 1.3 关键依据

three.js 官方在 r183 提供了 `three/addons/tsl/display/SSGINode.js` 与 `TRAANode.js`，可直接用 TSL 节点把 SSGI + AO + TRAA 接入 `RenderPipeline.outputNode`。这条路径替代了 WebGL 生态下的 N8AO + realism-effects 组合，避免回退渲染器。

## 2. 架构总览

### 2.1 文件改动清单

| 文件 | 动作 | 职责 |
|---|---|---|
| `public/hdri/studio.hdr` | 新增（资源） | 室内 studio HDRI（用户提供） |
| `src/sources.js` | 改 | 注册 `studioEnv` HDR 资源 |
| `src/renderer/Renderer.js` | 大改 | 单 pass → MRT pass + SSGI + TRAA + tonemapping |
| `src/world/environment.js` | 中改 | 移除 Hemi、加 IBL（PMREM）、给方向光开阴影 |
| `src/world/world.js` | 小改 | 模型遍历开 `castShadow / receiveShadow`、材质兜底 |
| `src/app/Experience.js` | 微改 | 给 `Environment` 传入 `resources` 与 `renderer`；注册 `Renderer.debuggerInit` |

### 2.2 设计原则

- **Renderer 是唯一承担管线复杂度的地方**：SSGI/TRAA/MRT 节点拼装全部封装在 `Renderer.attachPipeline()` 内部，对外 API 不变（`init / render / setSizeFromSizes`）。
- **Environment 只管光照地基**：SSGI 是间接光的"补"，直接光 + IBL 是地基。
- **World 不感知后处理**：只负责模型与阴影标记。

## 3. Renderer 管线（核心）

### 3.1 节点拓扑

```text
                          ┌─────────────────────────────────┐
                          │  pass(scene, camera) with MRT   │
                          │   ├─ output       (RGBA16F)     │
   scene + camera ───────▶│   ├─ diffuseColor (RGBA8)       │
                          │   ├─ normal       (RGBA8)       │
                          │   └─ velocity     (RG16F)       │
                          └────────┬────────────────────────┘
                                   │
       color / depth / normal      │
                                   ▼
                  ┌────────────────────────────────┐
                  │  ssgi(color, depth, normal,    │
                  │       camera)                  │
                  │   → giPass.rgb  (GI)           │
                  │   → giPass.a    (AO)           │
                  └────────┬───────────────────────┘
                           │
                           ▼
        composite = sceneColor.rgb * AO + diffuseColor.rgb * GI
                           │
                           ▼
                  ┌────────────────────────────────┐
                  │  traa(composite, depth,        │
                  │       velocity, camera)        │
                  └────────┬───────────────────────┘
                           │
                           ▼
                renderPipeline.outputNode
```

### 3.2 `Renderer` 接口约定

对外 API 保持不变：

- `new Renderer({ canvas })`
- `attachPipeline(scene, camera)`：内部从单 pass 升级为 MRT + SSGI + TRAA
- `init()`：内部新增 `instance.toneMapping = ACESFilmicToneMapping; toneMappingExposure = 1.0`
- `setSizeFromSizes(sizes)`：`pixelRatio = Math.min(devicePixelRatio, 1)`
- `render()`：不变

新增私有持有：

- `scenePass / giPass / traaPass / compositeNode` 引用
- `setOutputMode(mode)`：在 `Combined / AO / GI / Direct` 间切换 `renderPipeline.outputNode`，并 `renderPipeline.needsUpdate = true`
- `debuggerInit(debug)`：注册 Postprocess folder（详见 §6）

### 3.3 带宽优化（来自官方示例）

```text
diffuseTexture.type = THREE.UnsignedByteType
normalTexture.type  = THREE.UnsignedByteType
```

省一半带宽，对 SSGI 输入精度足够。

### 3.4 默认参数（平衡档）

```text
giPass.sliceCount.value = 2
giPass.stepCount.value  = 12
// radius / thickness / aoIntensity / giIntensity 全部用 SSGINode 默认值
pixelRatio cap = 1
TRAA 始终开启
```

### 3.5 关键决策

- **TRAA 始终开**：关闭后 SSGI 噪点严重；简化为永远开，少一个故障开关。
- **不实现 "GI 关闭" 模式**：把 `giIntensity` 拉 0 即可。
- **Tonemapping 选 ACES Filmic**：行业默认，工业设备风格也合适；后续可一行切 `NeutralToneMapping`。

## 4. Environment：真实感地基

### 4.1 改后的 `environment.js` 结构

构造签名变化：`new Environment(scene)` → `new Environment(scene, resources, renderer)`。

```text
class Environment {
  constructor(scene, resources, renderer) {
    // ① IBL：等 HDRI 加载完后接进 scene.environment
    eventBus.on('source ready', () => {
      const hdr = resources.items.studioEnv
      hdr.mapping = THREE.EquirectangularReflectionMapping
      const pmrem = new THREE.PMREMGenerator(renderer)
      const envRT = pmrem.fromEquirectangular(hdr)
      scene.environment = envRT.texture
      scene.environmentIntensity = 1.0
      hdr.dispose()
      pmrem.dispose()
    })

    // ② 主光：一盏方向光当 "厂房顶灯/窗光"，带阴影
    const key = new THREE.DirectionalLight(0xffffff, 2.5)
    key.position.set(6, 12, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 0.5
    key.shadow.camera.far  = 80
    key.shadow.camera.left   = -15
    key.shadow.camera.right  =  15
    key.shadow.camera.top    =  15
    key.shadow.camera.bottom = -15
    key.shadow.bias       = -0.0005
    key.shadow.normalBias = 0.02
    scene.add(key)

    // ③ 移除 HemisphereLight：与 IBL 功能重叠
    // ④ Fog 保留不变
  }
}
```

### 4.2 关键决策

- **PMREM 必须用渲染器实例做**：`Environment` 构造增加 `resources, renderer` 参数。这是本次唯一对外接口的破坏性改动。
- **`scene.background` 不设 HDRI**：保留原 fogColor (`#e8edf4`) 作为干净背景。展示工业品时背景越素净越好。
- **阴影贴图 2048**：足够清晰但不爆显存；正交体 ±15 按起重机包围盒经验给。
- **去掉 HemisphereLight**：避免和 IBL 功能重叠致整体提亮、丢对比。
- **Key light 强度 2.5**：补偿去掉 Hemi 后的整体亮度。

### 4.3 启用渲染器阴影

`Renderer.init()` 中追加：`this.instance.shadowMap.enabled = true`。

## 5. World：模型与材质处理

### 5.1 改动点

`world.js` 的 `eventBus.on('source ready', ...)` 回调里追加遍历：

```text
this.model.traverse((child) => {
  if (!child.isMesh) return
  child.castShadow    = true
  child.receiveShadow = true

  const mat = child.material
  if (mat && !mat.isMeshStandardMaterial) {
    child.material = new THREE.MeshPhysicalMaterial({
      color: mat.color ?? 0xcccccc,
      map:   mat.map   ?? null
    })
    mat.dispose?.()
  }
})
```

### 5.2 关键决策

- **不主动调粗糙度/金属度**：尊重 GLB 自带 PBR 数值，肉眼不对再手调。避免过度工程。
- **兜底替换**仅在材质明显非 PBR 时触发；正常 GLB 不会进这条分支，是防御性写法。
- **不加额外的接地平面**：模板项目保持简洁，需要时另作 1 行小决策。

## 6. 调试 UI（tweakpane）

继续用项目已有的 `Debug` + tweakpane，不引入官方示例的 `Inspector`，保持栈一致。

```text
Debug
├── Camera               (已有)
├── Environment          (已有 → 扩展)
│     ├── fog near/far
│     ├── environmentIntensity   ← 新
│     ├── toneMappingExposure    ← 新
│     ├── keyLight.intensity     ← 新
│     └── keyLight azimuth/elev  ← 新
└── Postprocess          ← 全新折叠面板，由 Renderer.debuggerInit 注册
      ├── Output mode: [Combined | AO | GI | Direct]
      ├── SSGI
      │     ├── sliceCount  (1..4, step 1)
      │     ├── stepCount   (1..32, step 1)
      │     ├── radius      (1..25)
      │     ├── thickness   (0.01..10)
      │     ├── aoIntensity (0..4)
      │     └── giIntensity (0..100)
      └── (TRAA 不暴露开关：始终开)
```

`Renderer` 实现 `debuggerInit(debug)`，由 `Experience.init()` 在 `if (this.debug.active)` 块里调用，与 `Environment / WorldCamera` 风格一致。

## 7. 资源与依赖

### 7.1 新增资源

- `public/hdri/studio.hdr`：用户提供（已下载并按命名放置）

### 7.2 `sources.js` 追加

```text
{ name: 'studioEnv', type: 'hdrTexture', path: 'hdri/studio.hdr' }
```

### 7.3 不新增 npm 依赖

`SSGINode` / `TRAANode` 来自 `three/addons/tsl/display/`，r183 已具备。

## 8. 风险与边界

| 风险 | 应对 |
|---|---|
| velocity buffer 全 0（场景静态） | TRAA 仍工作于相机抖动与 OrbitControls 阻尼，保持永开 |
| 阴影 acne / peter-panning | 已预设 `bias=-0.0005 / normalBias=0.02`，需要时再微调 |
| 起重机包围盒超出 ±15 阴影正交体 | World 在 framing 时可反向调整 shadow camera；属优化项，留作后续 |

## 9. 验证方式

1. 打开页面：起重机有阴影、金属表面有 IBL 反射高光。
2. tweakpane → Postprocess → Output mode 切到 **AO**：能看到清晰的接缝/凹角变暗。
3. 切到 **GI**：能看到带颜色的间接光（HDRI 偏冷/暖时凹处会带相应色）。
4. 切回 **Combined**：综合效果。
5. 性能：F12 → Performance，目标 1080p 中端独显 ≥ 45 FPS。

## 10. 不在本次范围

- 整模型材质审计与手调粗糙度/金属度
- 接地平面 / 展台
- HDRI 作为场景背景（仅作环境光源）
- shadow camera 跟随模型包围盒自适应
- 透明材质特殊处理（确认无透明材质）
- 跨设备 WebGPU 兜底（确认目标设备支持）
