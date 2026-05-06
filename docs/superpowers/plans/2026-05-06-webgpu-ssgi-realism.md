# WebGPU SSGI 真实感渲染管线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留 WebGPU/TSL 技术栈的前提下，给 `three.js-tsl-template` 接入 SSGI + AO + TRAA 后处理与 PBR 真实感地基（IBL + 阴影 + ACES tonemapping），使起重机 GLB 模型呈现工业品展示级视觉质量。

**Architecture:** Renderer 内部把 `pass(scene, camera)` 升级为 MRT 多目标输出，串接 `SSGINode`（输出 GI + AO）→ composite → `TRAANode` → `renderPipeline.outputNode`。Environment 用 PMREM 处理 studio HDRI 作为 `scene.environment`，用一盏由模型包围盒驱动位置/阴影正交体的方向光做主光，删除原有 HemisphereLight。World 仅遍历模型设置 `castShadow / receiveShadow` 与 PBR 材质兜底。

**Tech Stack:** Three.js r183 (`three/webgpu`)、TSL 节点系统（`three/tsl` 与 `three/addons/tsl/display/SSGINode.js`、`TRAANode.js`）、`PMREMGenerator`、`RGBELoader`、tweakpane、Vite。

**Spec:** `docs/superpowers/specs/2026-05-06-webgpu-ssgi-realism-design.md`

---

## 文件结构

| 文件 | 动作 | 责任 |
|---|---|---|
| `public/hdri/studio.hdr` | 用户已提供 | 室内 studio HDRI |
| `src/sources.js` | 修改 | 注册 `studioEnv` HDR 资源 |
| `src/renderer/Renderer.js` | 大改 | MRT pass + SSGI + TRAA + tonemapping + shadowMap |
| `src/world/environment.js` | 中改 | IBL + 阴影主光 + 包围盒自适应 |
| `src/world/world.js` | 小改 | castShadow / receiveShadow / 材质兜底 |
| `src/app/Experience.js` | 微改 | 给 Environment 传 renderer + resources + getModel；调 Renderer.debuggerInit |

## 验证约定

- 项目无单元测试框架，每个任务以"启动 dev server → 浏览器验收 → 提交"流程闭环。
- dev server 启动命令：`pnpm dev` （`vite`），默认 `http://localhost:5173/`。
- 浏览器开 F12 console，确认无报错；如有 `Debug` 面板（构造函数里 `this.active = true` 已强制开启），按对应任务说明操作面板验收。
- 视觉对比基线：每个任务的"预期表现"小节会描述应当看到的差异。

---

## Task 1: 注册 HDR 资源

**目的:** 让 `Resources` 能加载 `studio.hdr`，后续 Environment 才能拿到。

**Files:**
- Modify: `src/sources.js`

- [ ] **Step 1: 确认 HDR 文件存在**

Run:

```powershell
Get-Item public/hdri/studio.hdr
```

Expected: 输出文件信息（用户已确认下载并命名）。若不存在则停止，要求用户先放置文件。

- [ ] **Step 2: 在 sources.js 注册资源**

修改 `src/sources.js` 全文为：

```js
export default [
  {
    name: 'craneModel',
    type: 'gltfModel',
    path: 'model/crane.glb'
  },
  {
    name: 'studioEnv',
    type: 'hdrTexture',
    path: 'hdri/studio.hdr'
  }
]
```

- [ ] **Step 3: 启动 dev 验证加载**

Run: `pnpm dev`

打开 `http://localhost:5173/`，F12 console 应该没有 `[Resources] Failed to load hdrTexture "studioEnv"` 报错。画面尚未变化（HDR 还没有被使用）。

- [ ] **Step 4: 提交**

```bash
git add src/sources.js
git commit -m "feat(resources): 注册 studio HDR 环境贴图资源"
```

---

## Task 2: Renderer 加 tonemapping / shadowMap / pixelRatio cap

**目的:** 在引入 SSGI 之前，先把"PBR 真实感地基"中和渲染器相关的开关打开。这一步**不动管线拓扑**，仍然单 pass 输出，保证可回滚的小步推进。

**Files:**
- Modify: `src/renderer/Renderer.js`

- [ ] **Step 1: 修改 Renderer.js**

把 `src/renderer/Renderer.js` 全文替换为：

```js
import * as THREE from 'three/webgpu'
import { pass } from 'three/tsl'

export default class Renderer {
    /**
     * @param {{ canvas: HTMLCanvasElement }} options
     */
    constructor({ canvas }) {
        this.instance = new THREE.WebGPURenderer({
            canvas,
            forceWebGL: false
        })

        this.instance.toneMapping = THREE.ACESFilmicToneMapping
        this.instance.toneMappingExposure = 1.0
        this.instance.shadowMap.enabled = true

        /** @type {THREE.RenderPipeline | null} */
        this.renderPipeline = null
    }

    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     */
    attachPipeline(scene, camera) {
        const scenePass = pass(scene, camera)
        this.renderPipeline = new THREE.RenderPipeline(this.instance, scenePass)
    }

    async init() {
        await this.instance.init()
    }

    /**
     * @param {{ width: number, height: number }} sizes
     */
    setSizeFromSizes(sizes) {
        this.instance.setSize(sizes.width, sizes.height)
        this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 1))
    }

    render() {
        this.renderPipeline.render()
    }
}
```

变化点：
- 构造里设 `toneMapping = ACESFilmicToneMapping`、`toneMappingExposure = 1.0`、`shadowMap.enabled = true`。
- `setPixelRatio` 上限从 2 降到 1（性能预算）。

- [ ] **Step 2: 启动 dev 验证**

Run: `pnpm dev`

预期表现：画面整体颜色比之前略微"压缩高光"，看起来更柔和（ACES 的特征）。如果之前完全 sRGB 直输，现在会感觉对比度略降但白色不爆。F12 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/Renderer.js
git commit -m "feat(renderer): 启用 ACES tonemapping、shadowMap 与 pixelRatio cap"
```

---

## Task 3: Renderer 升级到 MRT 多目标输出

**目的:** 把 `pass(scene, camera)` 配置 MRT，输出 `output / diffuseColor / normal / velocity` 四张图，为 SSGI 做准备。本步骤暂不接 SSGI，`renderPipeline.outputNode` 直接接 `scenePassColor`，画面应与 Task 2 视觉一致——这是验证 MRT 没破坏现有渲染的关键。

**Files:**
- Modify: `src/renderer/Renderer.js`

- [ ] **Step 1: 修改 Renderer.js attachPipeline**

把 `src/renderer/Renderer.js` 全文替换为：

```js
import * as THREE from 'three/webgpu'
import {
    pass,
    mrt,
    output,
    diffuseColor,
    normalView,
    velocity,
    directionToColor
} from 'three/tsl'

export default class Renderer {
    /**
     * @param {{ canvas: HTMLCanvasElement }} options
     */
    constructor({ canvas }) {
        this.instance = new THREE.WebGPURenderer({
            canvas,
            forceWebGL: false
        })

        this.instance.toneMapping = THREE.ACESFilmicToneMapping
        this.instance.toneMappingExposure = 1.0
        this.instance.shadowMap.enabled = true

        /** @type {THREE.RenderPipeline | null} */
        this.renderPipeline = null
        /** @type {ReturnType<typeof pass> | null} */
        this.scenePass = null
    }

    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     */
    attachPipeline(scene, camera) {
        const scenePass = pass(scene, camera)
        scenePass.setMRT(
            mrt({
                output: output,
                diffuseColor: diffuseColor,
                normal: directionToColor(normalView),
                velocity: velocity
            })
        )

        const diffuseTexture = scenePass.getTexture('diffuseColor')
        diffuseTexture.type = THREE.UnsignedByteType
        const normalTexture = scenePass.getTexture('normal')
        normalTexture.type = THREE.UnsignedByteType

        const scenePassColor = scenePass.getTextureNode('output')

        this.scenePass = scenePass
        this.renderPipeline = new THREE.RenderPipeline(this.instance, scenePassColor)
    }

    async init() {
        await this.instance.init()
    }

    /**
     * @param {{ width: number, height: number }} sizes
     */
    setSizeFromSizes(sizes) {
        this.instance.setSize(sizes.width, sizes.height)
        this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 1))
    }

    render() {
        this.renderPipeline.render()
    }
}
```

- [ ] **Step 2: 启动 dev 验证**

Run: `pnpm dev`

预期表现：画面**与 Task 2 完全一致**（仅 MRT 多输出，仍只展示 output 通道）。如果出现黑屏或渲染异常，说明 MRT 导入或 `setMRT` 用法有问题，回到 spec §3.2 比对。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/Renderer.js
git commit -m "feat(renderer): scenePass 升级为 MRT 输出 (output/diffuse/normal/velocity)"
```

---

## Task 4: Renderer 接入 SSGI 与 composite

**目的:** 用 `SSGINode` 计算 GI 和 AO，按 `sceneColor.rgb * AO + diffuseColor.rgb * GI` 合成。**不接 TRAA**——这一步会有可见噪点，是预期的。

**Files:**
- Modify: `src/renderer/Renderer.js`

- [ ] **Step 1: 修改 Renderer.js，加入 SSGI 节点链**

把 `src/renderer/Renderer.js` 全文替换为：

```js
import * as THREE from 'three/webgpu'
import {
    pass,
    mrt,
    output,
    diffuseColor,
    normalView,
    velocity,
    directionToColor,
    colorToDirection,
    sample,
    add,
    vec4
} from 'three/tsl'
import { ssgi } from 'three/addons/tsl/display/SSGINode.js'

export default class Renderer {
    /**
     * @param {{ canvas: HTMLCanvasElement }} options
     */
    constructor({ canvas }) {
        this.instance = new THREE.WebGPURenderer({
            canvas,
            forceWebGL: false
        })

        this.instance.toneMapping = THREE.ACESFilmicToneMapping
        this.instance.toneMappingExposure = 1.0
        this.instance.shadowMap.enabled = true

        /** @type {THREE.RenderPipeline | null} */
        this.renderPipeline = null
        this.scenePass = null
        this.giPass = null
        this.compositeNode = null
    }

    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     */
    attachPipeline(scene, camera) {
        const scenePass = pass(scene, camera)
        scenePass.setMRT(
            mrt({
                output: output,
                diffuseColor: diffuseColor,
                normal: directionToColor(normalView),
                velocity: velocity
            })
        )

        scenePass.getTexture('diffuseColor').type = THREE.UnsignedByteType
        scenePass.getTexture('normal').type = THREE.UnsignedByteType

        const scenePassColor = scenePass.getTextureNode('output')
        const scenePassDiffuse = scenePass.getTextureNode('diffuseColor')
        const scenePassDepth = scenePass.getTextureNode('depth')
        const scenePassNormal = scenePass.getTextureNode('normal')

        const sceneNormal = sample((uv) => {
            return colorToDirection(scenePassNormal.sample(uv))
        })

        const giPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera)
        giPass.sliceCount.value = 2
        giPass.stepCount.value = 12

        const gi = giPass.rgb
        const ao = giPass.a

        const compositeNode = vec4(
            add(scenePassColor.rgb.mul(ao), scenePassDiffuse.rgb.mul(gi)),
            scenePassColor.a
        )

        this.scenePass = scenePass
        this.giPass = giPass
        this.compositeNode = compositeNode
        this.renderPipeline = new THREE.RenderPipeline(this.instance, compositeNode)
    }

    async init() {
        await this.instance.init()
    }

    /**
     * @param {{ width: number, height: number }} sizes
     */
    setSizeFromSizes(sizes) {
        this.instance.setSize(sizes.width, sizes.height)
        this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 1))
    }

    render() {
        this.renderPipeline.render()
    }
}
```

- [ ] **Step 2: 启动 dev 验证 SSGI 生效**

Run: `pnpm dev`

预期表现：
- 画面接缝、凹角处可以看到**变暗**（AO 效果）。
- 表面间能看到**互相染色**（GI 效果），最明显的是模型放在地面或两面贴近时，凹腔内有彩色辉散。
- 画面有可见的**颗粒噪点**——这是预期的，下一步 TRAA 解决。
- F12 console 无报错。

如果 console 报 `Cannot find module 'three/addons/tsl/display/SSGINode.js'`，确认 three 版本 ≥ 0.183.2。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/Renderer.js
git commit -m "feat(renderer): 接入 SSGI 节点输出 GI 与 AO 并 composite"
```

---

## Task 5: Renderer 接入 TRAA 完成管线

**目的:** 用 `TRAANode` 包住 composite 节点，同时承担抗锯齿和 SSGI 降噪两个职责。这是管线的最终形态。

**Files:**
- Modify: `src/renderer/Renderer.js`

- [ ] **Step 1: 修改 Renderer.js，加入 TRAA 节点**

在 `src/renderer/Renderer.js` 顶部 import 区追加 TRAA：

```js
import { traa } from 'three/addons/tsl/display/TRAANode.js'
```

并修改 `attachPipeline` 末尾的管线连接部分。完整替换 `attachPipeline` 方法为：

```js
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     */
    attachPipeline(scene, camera) {
        const scenePass = pass(scene, camera)
        scenePass.setMRT(
            mrt({
                output: output,
                diffuseColor: diffuseColor,
                normal: directionToColor(normalView),
                velocity: velocity
            })
        )

        scenePass.getTexture('diffuseColor').type = THREE.UnsignedByteType
        scenePass.getTexture('normal').type = THREE.UnsignedByteType

        const scenePassColor = scenePass.getTextureNode('output')
        const scenePassDiffuse = scenePass.getTextureNode('diffuseColor')
        const scenePassDepth = scenePass.getTextureNode('depth')
        const scenePassNormal = scenePass.getTextureNode('normal')
        const scenePassVelocity = scenePass.getTextureNode('velocity')

        const sceneNormal = sample((uv) => {
            return colorToDirection(scenePassNormal.sample(uv))
        })

        const giPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera)
        giPass.sliceCount.value = 2
        giPass.stepCount.value = 12

        const gi = giPass.rgb
        const ao = giPass.a

        const compositeNode = vec4(
            add(scenePassColor.rgb.mul(ao), scenePassDiffuse.rgb.mul(gi)),
            scenePassColor.a
        )

        const traaPass = traa(compositeNode, scenePassDepth, scenePassVelocity, camera)

        this.scenePass = scenePass
        this.giPass = giPass
        this.compositeNode = compositeNode
        this.traaPass = traaPass
        this.scenePassColor = scenePassColor
        this.gi = gi
        this.ao = ao
        this.renderPipeline = new THREE.RenderPipeline(this.instance, traaPass)
    }
```

> 注：`scenePassColor / gi / ao` 之所以挂在实例上，是为 Task 6 的输出模式切换做准备。

- [ ] **Step 2: 启动 dev 验证降噪**

Run: `pnpm dev`

预期表现：
- 相比 Task 4，画面**噪点显著消失**，AO/GI 平滑。
- 静止时画面非常稳定；轻微拖动鼠标转动相机时，可能在 1-2 帧内看到短暂残影或边缘抖动（TRAA 收敛过程，正常）。
- F12 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/Renderer.js
git commit -m "feat(renderer): 接入 TRAA 完成 SSGI 降噪与抗锯齿"
```

---

## Task 6: Renderer 加 debuggerInit（tweakpane 后处理面板）

**目的:** 让用户能在 tweakpane 实时切换输出模式（Combined/AO/GI/Direct）和调 SSGI 参数。

**Files:**
- Modify: `src/renderer/Renderer.js`
- Modify: `src/app/Experience.js`

- [ ] **Step 1: 给 Renderer 加 setOutputMode 与 debuggerInit**

在 `src/renderer/Renderer.js` 的 import 区追加 `vec3`（用于 AO 单通道可视化）：

```js
import {
    pass,
    mrt,
    output,
    diffuseColor,
    normalView,
    velocity,
    directionToColor,
    colorToDirection,
    sample,
    add,
    vec3,
    vec4
} from 'three/tsl'
```

在 `Renderer` 类内追加两个方法（放在 `render()` 之后）：

```js
    /**
     * @param {'combined'|'ao'|'gi'|'direct'} mode
     */
    setOutputMode(mode) {
        if (!this.renderPipeline) return
        switch (mode) {
            case 'ao':
                this.renderPipeline.outputNode = vec4(vec3(this.ao), 1)
                break
            case 'gi':
                this.renderPipeline.outputNode = vec4(this.gi, 1)
                break
            case 'direct':
                this.renderPipeline.outputNode = this.scenePassColor
                break
            case 'combined':
            default:
                this.renderPipeline.outputNode = this.traaPass
                break
        }
        this.renderPipeline.needsUpdate = true
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active || !this.giPass) return
        const folder = debug.addFolder({ title: 'Postprocess', expanded: false })
        if (!folder) return

        const state = { mode: 'combined' }
        folder
            .addBinding(state, 'mode', {
                label: 'Output',
                options: { Combined: 'combined', AO: 'ao', GI: 'gi', Direct: 'direct' }
            })
            .on('change', (ev) => this.setOutputMode(ev.value))

        const ssgi = folder.addFolder({ title: 'SSGI', expanded: true })
        ssgi.addBinding(this.giPass.sliceCount, 'value', { min: 1, max: 4, step: 1, label: 'sliceCount' })
        ssgi.addBinding(this.giPass.stepCount, 'value', { min: 1, max: 32, step: 1, label: 'stepCount' })
        ssgi.addBinding(this.giPass.radius, 'value', { min: 1, max: 25, label: 'radius' })
        ssgi.addBinding(this.giPass.thickness, 'value', { min: 0.01, max: 10, label: 'thickness' })
        ssgi.addBinding(this.giPass.aoIntensity, 'value', { min: 0, max: 4, label: 'aoIntensity' })
        ssgi.addBinding(this.giPass.giIntensity, 'value', { min: 0, max: 100, label: 'giIntensity' })
    }
```

- [ ] **Step 2: 在 Experience.init 中调用 Renderer.debuggerInit**

修改 `src/app/Experience.js` 的 `init()` 方法末尾的 debug 块，把当前：

```js
        if (this.debug.active) {
            this.environment.debuggerInit(this.debug)
            this.worldCamera.debuggerInit(this.debug)
        }
```

改为：

```js
        if (this.debug.active) {
            this.environment.debuggerInit(this.debug)
            this.worldCamera.debuggerInit(this.debug)
            this.renderer.debuggerInit(this.debug)
        }
```

- [ ] **Step 3: 启动 dev 验证 tweakpane**

Run: `pnpm dev`

预期表现：
- 右上角 Debug 面板里出现新的 `Postprocess` 折叠区。
- 切换 Output：选 `AO` 应看到灰度图（凹角变黑），选 `GI` 应看到带颜色的间接光分布，选 `Direct` 是无 AO/GI 的原始 PBR，选 `Combined` 回到合成结果。
- 拖动 `aoIntensity` 实时改变阴影深度；拖动 `giIntensity` 实时改变间接光强度。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/Renderer.js src/app/Experience.js
git commit -m "feat(debug): tweakpane 暴露 SSGI 参数与输出模式切换"
```

---

## Task 7: Environment 加 IBL（PMREM）并改造主光

**目的:** 用 PMREM 处理 studio HDRI 作为 `scene.environment`，删除 HemisphereLight，把 DirectionalLight 提为有阴影的 Key light（位置/阴影体先用临时占位值，下一任务再用 bbox 自适应）。

**Files:**
- Modify: `src/world/environment.js`
- Modify: `src/app/Experience.js`

- [ ] **Step 1: 改写 environment.js**

把 `src/world/environment.js` 全文替换为：

```js
import * as THREE from 'three/webgpu'
import { color, fog, rangeFogFactor, uniform } from 'three/tsl'
import { eventBus } from '../utils/event-bus.js'

export default class Environment {
    /**
     * @param {THREE.Scene} scene
     * @param {import('../utils/Resources.js').default} resources
     * @param {THREE.WebGPURenderer} renderer
     * @param {() => (THREE.Object3D | null)} getModel
     */
    constructor(scene, resources, renderer, getModel) {
        this.scene = scene
        this.resources = resources
        this.renderer = renderer
        this.getModel = getModel

        this.fogColor = uniform(color('#e8edf4'))
        this.fogRange = { near: 120, far: 450 }
        this._rebuildFog()

        this.keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
        this.keyLight.position.set(20, 40, 20)
        this.keyLight.castShadow = true
        this.keyLight.shadow.mapSize.set(2048, 2048)
        this.keyLight.shadow.bias = -0.0005
        this.keyLight.shadow.normalBias = 0.05
        this.scene.add(this.keyLight)
        this.scene.add(this.keyLight.target)

        eventBus.on('source ready', () => this._onSourcesReady())
    }

    _onSourcesReady() {
        const hdr = this.resources.items.studioEnv
        if (!hdr) {
            console.error('[Environment] studioEnv HDR not loaded')
            return
        }
        hdr.mapping = THREE.EquirectangularReflectionMapping
        const pmrem = new THREE.PMREMGenerator(this.renderer)
        const envRT = pmrem.fromEquirectangular(hdr)
        this.scene.environment = envRT.texture
        this.scene.environmentIntensity = 1.0
        hdr.dispose()
        pmrem.dispose()
    }

    _rebuildFog() {
        this.scene.fogNode = fog(
            this.fogColor,
            rangeFogFactor(this.fogRange.near, this.fogRange.far)
        )
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active) return
        const folder = debug.addFolder({ title: 'Environment', expanded: false })
        if (!folder) return
        folder
            .addBinding(this.fogRange, 'near', { min: 0.1, max: 400, step: 1, label: 'fog near' })
            .on('change', () => this._rebuildFog())
        folder
            .addBinding(this.fogRange, 'far', { min: 1, max: 800, step: 1, label: 'fog far' })
            .on('change', () => this._rebuildFog())
    }
}
```

变化点：
- 构造签名改为 `(scene, resources, renderer, getModel)`。
- 删除 HemisphereLight。
- DirectionalLight 改为 `keyLight`，开阴影，临时位置 `(20, 40, 20)`（保证不在模型内）。
- `'source ready'` 时建 PMREM 接 `scene.environment`。

- [ ] **Step 2: 改 Experience.js 给 Environment 传新参数**

修改 `src/app/Experience.js` 构造函数中的 Environment 实例化。把：

```js
        this.environment = new Environment(this.scene)
```

改为（注意 `this.resources` 在原代码里晚于 `this.environment` 创建——下一步把它提前）：

```js
        this.resources = new Resources()
        this.environment = new Environment(
            this.scene,
            this.resources,
            this.renderer.instance,
            () => this.world?.model ?? null
        )
```

并删除原本 `this.world = new World(this)` 之后那行 `this.resources = new Resources()`（已被前移）。最终 `Experience` 构造函数相关片段顺序应为：

```js
        this.scene = new THREE.Scene()
        this.resources = new Resources()
        this.environment = new Environment(
            this.scene,
            this.resources,
            this.renderer.instance,
            () => this.world?.model ?? null
        )

        this.worldCamera = new WorldCamera(canvas, this.sizes)
        this.scene.add(this.worldCamera.instance)

        this.world = new World(this)
```

> 关键：`Resources` 必须在 `Environment` **之前**创建，否则 `'source ready'` 事件可能在 Environment 注册监听之前就触发。`World` 仍然在 `Environment` 之后，因为闭包 `() => this.world?.model` 是惰性求值。

- [ ] **Step 3: 启动 dev 验证 IBL**

Run: `pnpm dev`

预期表现：
- 模型金属表面有可见的**环境反射**（高光形态来自 HDRI）。
- 整体亮度适中，不再像 hemi 那样均匀打亮。
- 模型在地下/接地处有一条**硬阴影线**（来自 keyLight）——但因为位置还没适配 bbox，阴影形状可能不完美甚至从模型外打过去。
- F12 无报错。
- tweakpane 的 Postprocess → Output → AO 模式下，凹陷处变化更明显。

- [ ] **Step 4: 提交**

```bash
git add src/world/environment.js src/app/Experience.js
git commit -m "feat(env): 用 PMREM 接入 studio HDRI 并将主光改为有阴影的方向光"
```

---

## Task 8: Environment 用包围盒驱动 Key light 与阴影正交体

**目的:** 模型实测包围盒为 `17.77 × 28.74 × 53.41`，包围球半径 ≈ 31.6m。光源/阴影必须按 bbox 自适应，否则覆盖不全。

**Files:**
- Modify: `src/world/environment.js`

- [ ] **Step 1: 在 environment.js 添加 _fitKeyLightToModel**

在 `Environment` 类的 `_onSourcesReady` 方法之后追加：

```js
    /**
     * @param {THREE.Object3D} object
     */
    _fitKeyLightToModel(object) {
        const box = new THREE.Box3().setFromObject(object)
        if (box.isEmpty()) return

        const center = box.getCenter(new THREE.Vector3())
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        const R = sphere.radius

        const dir = new THREE.Vector3(0.5, 1.5, 0.5).normalize()
        const dist = R * 2

        this.keyLight.position.copy(center).addScaledVector(dir, dist)
        this.keyLight.target.position.copy(center)
        this.keyLight.target.updateMatrixWorld()

        const m = R * 1.1
        const cam = this.keyLight.shadow.camera
        cam.left = -m
        cam.right = m
        cam.top = m
        cam.bottom = -m
        cam.near = Math.max(0.5, dist - R * 1.2)
        cam.far = dist + R * 1.2
        cam.updateProjectionMatrix()
    }
```

并在 `_onSourcesReady` 末尾追加调用：

```js
    _onSourcesReady() {
        const hdr = this.resources.items.studioEnv
        if (!hdr) {
            console.error('[Environment] studioEnv HDR not loaded')
            return
        }
        hdr.mapping = THREE.EquirectangularReflectionMapping
        const pmrem = new THREE.PMREMGenerator(this.renderer)
        const envRT = pmrem.fromEquirectangular(hdr)
        this.scene.environment = envRT.texture
        this.scene.environmentIntensity = 1.0
        hdr.dispose()
        pmrem.dispose()

        const model = this.getModel?.()
        if (model) {
            this._fitKeyLightToModel(model)
        }
    }
```

- [ ] **Step 2: 启动 dev 验证阴影包覆**

Run: `pnpm dev`

预期表现：
- Key light 位置移到模型外上方（按包围球半径 31.6m × 2 ≈ 63m 的距离）。
- 整个起重机都在阴影正交体覆盖范围内：模型脚下有完整的投影，**没有"阴影硬切"**（即没有 shadow camera 边界把阴影切掉的现象）。
- 用 OrbitControls 转动相机俯视，应看到完整的下方投影轮廓。
- 如果出现 acne（表面竖条纹），把 `normalBias` 从 0.05 微调到 0.07~0.1 重试；如果出现 peter-panning（阴影脱离物体底部），把 `bias` 从 -0.0005 调到 -0.0002。

- [ ] **Step 3: 提交**

```bash
git add src/world/environment.js
git commit -m "feat(env): 用模型包围盒驱动 Key light 位置与阴影正交体"
```

---

## Task 9: Environment 扩展 debuggerInit

**目的:** 把 `environmentIntensity / toneMappingExposure / keyLight 强度与方向角` 暴露到 tweakpane。

**Files:**
- Modify: `src/world/environment.js`

- [ ] **Step 1: 扩展 debuggerInit**

把 `Environment.debuggerInit` 完整替换为：

```js
    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active) return
        const folder = debug.addFolder({ title: 'Environment', expanded: false })
        if (!folder) return

        folder
            .addBinding(this.fogRange, 'near', { min: 0.1, max: 400, step: 1, label: 'fog near' })
            .on('change', () => this._rebuildFog())
        folder
            .addBinding(this.fogRange, 'far', { min: 1, max: 800, step: 1, label: 'fog far' })
            .on('change', () => this._rebuildFog())

        const envState = { intensity: this.scene.environmentIntensity ?? 1 }
        folder
            .addBinding(envState, 'intensity', { min: 0, max: 3, step: 0.01, label: 'env intensity' })
            .on('change', (ev) => {
                this.scene.environmentIntensity = ev.value
            })

        const tmState = { exposure: this.renderer.toneMappingExposure }
        folder
            .addBinding(tmState, 'exposure', { min: 0, max: 3, step: 0.01, label: 'tonemap exposure' })
            .on('change', (ev) => {
                this.renderer.toneMappingExposure = ev.value
            })

        const lightState = {
            intensity: this.keyLight.intensity,
            azimuthDeg: 45,
            elevationDeg: 60
        }
        const applyLightDir = () => {
            const az = THREE.MathUtils.degToRad(lightState.azimuthDeg)
            const el = THREE.MathUtils.degToRad(lightState.elevationDeg)
            const target = this.keyLight.target.position
            const center = target.clone()
            const R = this.keyLight.position.distanceTo(target)
            const dir = new THREE.Vector3(
                Math.cos(el) * Math.cos(az),
                Math.sin(el),
                Math.cos(el) * Math.sin(az)
            )
            this.keyLight.position.copy(center).addScaledVector(dir, R || 1)
        }
        folder.addBinding(lightState, 'intensity', { min: 0, max: 10, step: 0.05, label: 'key intensity' }).on('change', (ev) => {
            this.keyLight.intensity = ev.value
        })
        folder.addBinding(lightState, 'azimuthDeg', { min: -180, max: 180, step: 1, label: 'key azimuth' }).on('change', applyLightDir)
        folder.addBinding(lightState, 'elevationDeg', { min: 5, max: 89, step: 1, label: 'key elevation' }).on('change', applyLightDir)
    }
```

- [ ] **Step 2: 启动 dev 验证 UI 可调**

Run: `pnpm dev`

预期表现：
- Debug → Environment 折叠区里出现 `env intensity / tonemap exposure / key intensity / key azimuth / key elevation` 五个新滑块。
- 拖动 `env intensity`：场景的"环境光"亮度变化；置 0 时仅靠 keyLight 直接光。
- 拖动 `tonemap exposure`：整体曝光改变。
- 拖动 `key azimuth/elevation`：阴影方向跟随旋转。

- [ ] **Step 3: 提交**

```bash
git add src/world/environment.js
git commit -m "feat(debug): Environment 面板加入 IBL/曝光/Key light 实时调参"
```

---

## Task 10: World 加阴影标记与材质兜底

**目的:** GLB 加载后遍历模型，开 `castShadow / receiveShadow`，并在材质明显非 PBR 时替换为 MeshPhysicalMaterial。

**Files:**
- Modify: `src/world/world.js`

- [ ] **Step 1: 修改 world.js 的 'source ready' 回调**

把 `src/world/world.js` 中 `eventBus.on('source ready', ...)` 整段替换为：

```js
        eventBus.on('source ready', () => {
            const gltf = this.experience.resources?.items?.craneModel
            if (!gltf?.scene) {
                return
            }

            this.model = gltf.scene
            this._prepareMeshes(this.model)
            this.scene.add(this.model)
            this._frameCameraToModel(this.model)
        })
```

并在类内追加 `_prepareMeshes` 方法（放在 `_frameCameraToModel` 旁边）：

```js
    /**
     * @param {THREE.Object3D} root
     */
    _prepareMeshes(root) {
        root.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return
            child.castShadow = true
            child.receiveShadow = true

            const mat = child.material
            if (mat && !mat.isMeshStandardMaterial) {
                const fallback = new THREE.MeshPhysicalMaterial({
                    color: mat.color ?? 0xcccccc,
                    map: mat.map ?? null
                })
                child.material = fallback
                mat.dispose?.()
            }
        })
    }
```

- [ ] **Step 2: 启动 dev 验证阴影**

Run: `pnpm dev`

预期表现：
- 起重机的各部件之间相互投射阴影（如吊臂在车体上的影子）。
- 模型脚下有清晰的整体投影。
- 之前 Task 8 验证时如果没看到细节阴影（因为 mesh 没开 cast/receive），这一步应该补全。

- [ ] **Step 3: 提交**

```bash
git add src/world/world.js
git commit -m "feat(world): 模型遍历开启 castShadow/receiveShadow 与 PBR 材质兜底"
```

---

## Task 11: 终态视觉验收与微调

**目的:** 整体跑一遍验证 spec §9 的所有验证点，必要时微调默认参数。

**Files:** （仅在需要微调时修改）

- [ ] **Step 1: 启动 dev**

Run: `pnpm dev`

打开 `http://localhost:5173/`。

- [ ] **Step 2: 走完 spec §9 验证清单**

依次确认：
1. 起重机有阴影、金属表面有 IBL 反射高光。
2. tweakpane → Postprocess → Output 切到 `AO`：能清晰看到接缝/凹角变暗。
3. 切到 `GI`：能看到带颜色的间接光，HDRI 偏冷/暖时凹处带相应色。
4. 切回 `Combined`：综合效果观感比基线（Task 2 后）显著更"立体真实"。
5. F12 → Performance（或 Stats），1080p 中端独显期望 ≥ 45 FPS。

- [ ] **Step 3: 如有问题进行微调（可选）**

常见问题与对策：

| 现象 | 调整 |
|---|---|
| 画面偏暗 | tweakpane 提 `tonemap exposure`（如 1.2）或 `env intensity` |
| 画面偏亮、高光爆 | 降 `tonemap exposure`（如 0.8） |
| AO 太重 | 降 `aoIntensity`（如 0.7） |
| GI 染色过强 | 降 `giIntensity`（如默认值的一半） |
| 阴影 acne 条纹 | 改 `Environment` 里 `normalBias` 0.05 → 0.08 |
| 阴影脱离脚底 | 改 `bias` -0.0005 → -0.0002 |
| 帧率不达标 | 把 `stepCount` 12 → 8（spec 流畅档默认值） |

如果做了任何代码层面的调整，单独提交：

```bash
git add -A
git commit -m "tune: 验收阶段微调 SSGI/曝光/阴影默认值"
```

如果默认值已经满意，**不做提交**——这是合规的"无改动"收尾。

- [ ] **Step 4: 总结提交**

确认 git status 干净后输出最终验收信息：

```bash
git log --oneline -15
git status
```

预期 status 显示 `nothing to commit, working tree clean`，git log 应包含 Task 1–10 的提交（如 Task 11 有微调则 11 个）。
