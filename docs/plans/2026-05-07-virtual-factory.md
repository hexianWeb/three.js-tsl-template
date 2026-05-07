# 虚拟工厂可视化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `src/world/world.js` 中直接处理 `craneModel` 的逻辑抽离为可复例化的 `Crane` 组件，配合 `TankField`（InstancedMesh）/`Rails`（`railway.glb` 双实例）/`Flybar`，并以本地仿真（1Hz tick）驱动状态机，构建未来可平滑切换为短轮询后台的可视化架构。

**Architecture:** 本期采用 `FactoryController → FactoryState + 视觉实体`：`FactoryController` 同时承担本地仿真派单与 Crane/Flybar 动画编排，`FactoryState` 保持纯数据，视觉实体负责自身 mesh / material / label。后续接后台时拆出 `PollingAdapter` 写入 `FactoryState`，再由 Controller/视觉实体消费状态。详见 [`2026-05-07-virtual-factory-design.md`](./2026-05-07-virtual-factory-design.md)。

**Tech Stack:** Three.js 0.183 (`three/webgpu` + `three/tsl`)、gsap 3.15、mitt 3、Vite 5。

**Testing strategy:** 当前项目无测试框架，且场景以视觉为主。每个任务的「验证」改为：① `npm run dev` 启动；② 浏览器打开 `http://localhost:5173`；③ 控制台无报错；④ 视觉/DevTools Stats 满足任务声明的检查项。验收清单见设计文档 §5.4。

**Asset prerequisites（开始本计划前由用户提供）：**
- `public/model/crane.glb`：天车模型
- `public/model/flybar.glb`：单根飞杆模型
- `public/model/box.glb`：单个药水槽模型
- `public/model/railway.glb`：单根钢轨模型

**Asset conventions（已由 Blender 侧确认）：**
- 所有 GLB 的 forward / up 方向、物体原点、比例已处理好，运行时代码不做 scale，也不额外调整 rotation。
- `flybar` 在槽上时使用世界坐标 `(tank.x, -8, tank.z)`。
- `flybar` 在天车上时使用世界坐标 `(crane.x, 12, crane.z)`。
- 天车始终只沿 X 轴移动；两根钢轨分别放置在 `(0, 15, -26)` 与 `(0, 15, 26)`。
- 药水槽只有 1 行，共 40 个；槽体 X 向宽度 `8.57`，槽间步距为 `8.57 * 1.2 = 10.284`。

资源缺失或加载失败必须保留 `Resources` 层的 `console.error`，不要吞错或早退兼容；本期资源都应可用，缺失应尽早暴露。

---

## Task 0: 基线确认

**Files:** —

**Step 1:** 安装依赖、启动开发服务器

```powershell
pnpm install
pnpm dev
```

**Step 2:** 浏览器打开 `http://localhost:5173`，确认现有 `crane.glb` 已能渲染、控制台无报错。

**Step 3:** 确认 `public/model/crane.glb`、`public/model/flybar.glb`、`public/model/box.glb` 与 `public/model/railway.glb` 存在：

```powershell
Get-ChildItem public/model
```

期望输出至少包含 `crane.glb`、`flybar.glb`、`box.glb`、`railway.glb`。如缺失则停止本计划；不要添加 fallback 模型。

**Step 4:** 创建工作分支（如未在隔离 worktree 中）

```powershell
git checkout -b feat/virtual-factory
```

**Commit:** —（无代码改动）

---

## Task 1: 资源清单扩展

**Files:**
- Modify: `src/sources.js`

**Step 1:** 在 `src/sources.js` 中追加三条工厂资源：

```js
export default [
  {
    name: 'craneModel',
    type: 'gltfModel',
    path: 'model/crane.glb'
  },
  {
    name: 'flybarModel',
    type: 'gltfModel',
    path: 'model/flybar.glb'
  },
  {
    name: 'tankBoxModel',
    type: 'gltfModel',
    path: 'model/box.glb'
  },
  {
    name: 'railwayModel',
    type: 'gltfModel',
    path: 'model/railway.glb'
  },
  {
    name: 'studioEnv',
    type: 'hdrTexture',
    path: 'hdri/studio.hdr'
  }
]
```

**Step 2:** 启动 dev server，浏览器控制台应无 404；现有 crane 仍正常显示。

**Step 3:** Commit

```powershell
git add src/sources.js
git commit -m "feat(sources): add virtual factory model entries"
```

---

## Task 2: Factory 配置常量

**Files:**
- Create: `src/world/factory/config.js`

**Step 1:** 创建文件并写入：

```js
/**
 * 工厂布局常量。所有数值仅用于本地仿真展示，
 * 后续接入后台时由 PollingAdapter 写入 FactoryState 覆盖动态状态。
 */
export const TANK_WIDTH_X = 8.57
export const TANK_SPACING_X = TANK_WIDTH_X * 1.2
export const TANK_COUNT = 40
export const FLYBAR_TANK_Y = -8
export const FLYBAR_CRANE_Y = 12

export const FACTORY_CONFIG = {
  rails: {
    positions: [
      [0, 15, -26],
      [0, 15, 26]
    ]
  },
  tanks: {
    rows: 1,
    cols: TANK_COUNT,
    widthX: TANK_WIDTH_X,
    spacingX: TANK_SPACING_X,
    rowZ: [0],
    originX: -((TANK_COUNT - 1) * TANK_SPACING_X) / 2,
    baseRoughness: 0.6,
    baseMetalness: 0.4,
    jitter: 0.2
  },
  cranes: [
    { id: 'A', initialX: -30, initialY: 0, initialZ: 0, mode: 'auto' },
    { id: 'B', initialX: 0,   initialY: 0, initialZ: 0, mode: 'manual' },
    { id: 'C', initialX: 30,  initialY: 0, initialZ: 0, mode: 'maintenance' }
  ],
  flybars: {
    count: 6
  },
  sim: {
    tickMs: 1000,
    modeRotateMs: 15000
  },
  modeColors: {
    auto: '#22c55e',
    manual: '#eab308',
    maintenance: '#ef4444'
  }
}
```

**Step 2:** Commit

```powershell
git add src/world/factory/config.js
git commit -m "feat(factory): add layout config constants"
```

---

## Task 3: FactoryState（纯数据 + mitt）

**Files:**
- Create: `src/world/factory/state/FactoryState.js`

**Step 1:** 写入：

```js
import mitt from 'mitt'
import { FACTORY_CONFIG } from '../config.js'

/**
 * @returns {{
 *   cranes: Array<{ id: string, mode: string, status: string, x: number,
 *                   labelText: string, trackText: string,
 *                   carryingFlybarId: number|null,
 *                   task: { fromTankId: number, toTankId: number, flybarId: number } | null }>,
 *   tanks: Array<{ id: number, x: number, z: number, occupiedFlybarId: number|null }>,
 *   flybars: Array<{ id: number, location: { kind: 'tank'|'crane', tankId?: number, craneId?: string } }>,
 *   on: Function, off: Function, emit: Function
 * }}
 */
export function createFactoryState() {
  const emitter = mitt()

  const tanks = []
  let tid = 0
  for (let r = 0; r < FACTORY_CONFIG.tanks.rows; r++) {
    for (let c = 0; c < FACTORY_CONFIG.tanks.cols; c++) {
      tanks.push({
        id: tid++,
        x: FACTORY_CONFIG.tanks.originX + c * FACTORY_CONFIG.tanks.spacingX,
        z: FACTORY_CONFIG.tanks.rowZ[r],
        occupiedFlybarId: null
      })
    }
  }

  const cranes = FACTORY_CONFIG.cranes.map((c) => ({
    id: c.id,
    mode: c.mode,
    status: 'idle',
    x: c.initialX,
    labelText: c.id,
    trackText: '待机',
    carryingFlybarId: null,
    task: null
  }))

  const flybars = []
  const initialTankIds = pickFirstN(tanks.length, FACTORY_CONFIG.flybars.count)
  for (let i = 0; i < FACTORY_CONFIG.flybars.count; i++) {
    const tankId = initialTankIds[i]
    flybars.push({ id: i, location: { kind: 'tank', tankId } })
    tanks[tankId].occupiedFlybarId = i
  }

  return {
    cranes,
    tanks,
    flybars,
    on: emitter.on,
    off: emitter.off,
    emit: emitter.emit
  }
}

function pickFirstN(total, n) {
  const idx = []
  const step = Math.max(1, Math.floor(total / n))
  for (let i = 0; i < n; i++) idx.push((i * step) % total)
  return idx
}
```

**Step 2:** 烟测：在 `src/main.js` 顶部临时 `import { createFactoryState } from './world/factory/state/FactoryState.js'; console.log(createFactoryState())`，刷新页面，控制台应能打出含 `cranes/tanks/flybars` 的对象。

**Step 3:** 移除临时 import（保持 `main.js` 干净）。

**Step 4:** Commit

```powershell
git add src/world/factory/state/FactoryState.js
git commit -m "feat(factory): add FactoryState (pure data + mitt)"
```

---

## Task 4: CanvasTexture Label Plane 工厂

**Files:**
- Create: `src/world/factory/labels/createLabelPlane.js`

**Step 1:** 写入：

```js
import * as THREE from 'three/webgpu'

/**
 * @param {{
 *   width: number,
 *   height: number,
 *   canvasW?: number,
 *   canvasH?: number,
 *   draw: (ctx: CanvasRenderingContext2D, text: string) => void
 * }} options
 */
export function createLabelPlane({ width, height, canvasW = 256, canvasH = 256, draw }) {
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  const geometry = new THREE.PlaneGeometry(width, height)
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  const mesh = new THREE.Mesh(geometry, material)

  let lastText = null
  function setText(text) {
    if (text === lastText) return
    lastText = text
    ctx.clearRect(0, 0, canvasW, canvasH)
    draw(ctx, text)
    texture.needsUpdate = true
  }

  function dispose() {
    geometry.dispose()
    material.dispose()
    texture.dispose()
  }

  return { mesh, setText, dispose }
}

export function drawLabel(ctx, text) {
  const { width, height } = ctx.canvas
  ctx.fillStyle = '#c0392b'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 180px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text ?? '', width / 2, height / 2 + 8)
}

export function drawTrack(ctx, text) {
  const { width, height } = ctx.canvas
  ctx.fillStyle = 'rgba(20,30,48,0.85)'
  roundRect(ctx, 8, height / 2 - 36, width - 16, 72, 16)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 44px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text ?? '', width / 2, height / 2)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
}
```

**Step 2:** Commit

```powershell
git add src/world/factory/labels/createLabelPlane.js
git commit -m "feat(factory): add CanvasTexture label plane factory"
```

---

## Task 5: TSL 材质工厂

**Files:**
- Create: `src/world/factory/materials/createCraneMaterial.js`
- Create: `src/world/factory/materials/createTankMaterial.js`

**Step 1:** `createCraneMaterial.js`：

```js
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { texture, uniform, color, vec3, mix } from 'three/tsl'

/**
 * @param {THREE.Texture | null} baseMap
 * @param {{ tintStrength?: number, modeColor?: string,
 *           metalness?: number, roughness?: number }} [opts]
 */
export function createCraneMaterial(baseMap, opts = {}) {
  const mat = new MeshStandardNodeMaterial()
  const modeColor    = uniform(color(opts.modeColor ?? '#22c55e'))
  const tintStrength = uniform(opts.tintStrength ?? 0.5)

  if (baseMap) {
    const sampled = texture(baseMap)
    const tintMul = mix(vec3(1, 1, 1), modeColor, tintStrength)
    mat.colorNode = sampled.rgb.mul(tintMul)
  } else {
    const tintMul = mix(vec3(1, 1, 1), modeColor, tintStrength)
    mat.colorNode = vec3(0.7, 0.7, 0.7).mul(tintMul)
  }

  mat.metalness = opts.metalness ?? 0.3
  mat.roughness = opts.roughness ?? 0.7
  mat.userData = { modeColor, tintStrength }
  return mat
}
```

**Step 2:** `createTankMaterial.js`：

```js
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { texture, attribute } from 'three/tsl'

/**
 * @param {THREE.Texture | null} baseMap
 */
export function createTankMaterial(baseMap) {
  const mat = new MeshStandardNodeMaterial()
  if (baseMap) {
    mat.colorNode = texture(baseMap)
  }
  mat.roughnessNode = attribute('aRough', 'float')
  mat.metalnessNode = attribute('aMetal', 'float')
  return mat
}
```

**Step 3:** Commit

```powershell
git add src/world/factory/materials
git commit -m "feat(factory): add TSL crane & tank material factories"
```

---

## Task 6: Rails 实体（railway.glb 双实例）

**Files:**
- Create: `src/world/factory/entities/Rails.js`

**Step 1:** 写入：

```js
import * as THREE from 'three/webgpu'
import { FACTORY_CONFIG } from '../config.js'

export default class Rails {
  /**
   * @param {THREE.Object3D} railwayScene  railway.glb 的 scene
   */
  constructor(railwayScene) {
    this.root = new THREE.Group()
    this.root.name = 'Rails'

    for (const pos of FACTORY_CONFIG.rails.positions) {
      const rail = railwayScene.clone(true)
      rail.position.set(pos[0], pos[1], pos[2])
      rail.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      this.root.add(rail)
    }
  }

  dispose() {
    // GLB geometry/material/texture belong to Resources; Rails only removes clones.
    this.root.parent?.remove(this.root)
  }
}
```

**Step 2:** Commit

```powershell
git add src/world/factory/entities/Rails.js
git commit -m "feat(factory): add railway model rails entity"
```

---

## Task 7: TankField（InstancedMesh + per-instance 抖动）

**Files:**
- Create: `src/world/factory/entities/TankField.js`

**Step 1:** 写入：

```js
import * as THREE from 'three/webgpu'
import { FACTORY_CONFIG, FLYBAR_TANK_Y } from '../config.js'
import { createTankMaterial } from '../materials/createTankMaterial.js'

export default class TankField {
  /**
   * @param {THREE.Object3D} boxScene  box.glb 的 scene
   * @param {Array<{ id: number, x: number, z: number }>} tankStates
   */
  constructor(boxScene, tankStates) {
    this.root = new THREE.Group()
    this.root.name = 'TankField'

    const sourceMesh = findFirstMesh(boxScene)
    if (!sourceMesh) {
      throw new Error('[TankField] box.glb contains no mesh')
    }
    const geometry = sourceMesh.geometry.clone()
    const baseMap = sourceMesh.material?.map ?? null

    const count = tankStates.length
    const aRough = new Float32Array(count)
    const aMetal = new Float32Array(count)
    const { baseRoughness, baseMetalness, jitter } = FACTORY_CONFIG.tanks
    for (let i = 0; i < count; i++) {
      aRough[i] = clamp01(baseRoughness + (Math.random() * 2 - 1) * jitter)
      aMetal[i] = clamp01(baseMetalness + (Math.random() * 2 - 1) * jitter)
    }
    geometry.setAttribute('aRough', new THREE.InstancedBufferAttribute(aRough, 1))
    geometry.setAttribute('aMetal', new THREE.InstancedBufferAttribute(aMetal, 1))

    const material = createTankMaterial(baseMap)

    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.castShadow = true
    mesh.receiveShadow = true

    const dummy = new THREE.Object3D()
    this.anchors = []
    for (let i = 0; i < count; i++) {
      const t = tankStates[i]
      dummy.position.set(t.x, 0, t.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      const anchor = new THREE.Object3D()
      anchor.position.set(t.x, FLYBAR_TANK_Y, t.z)
      this.root.add(anchor)
      this.anchors.push(anchor)
    }
    mesh.instanceMatrix.needsUpdate = true

    this.root.add(mesh)
    this.mesh = mesh
    this.material = material
    this.geometry = geometry
  }

  /** @param {number} tankId */
  getAnchor(tankId) { return this.anchors[tankId] }

  update() {}

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
    this.root.parent?.remove(this.root)
  }
}

function findFirstMesh(root) {
  let found = null
  root.traverse((c) => { if (!found && c.isMesh) found = c })
  return found
}

function clamp01(v) { return Math.max(0, Math.min(1, v)) }
```

**Step 2:** Commit

```powershell
git add src/world/factory/entities/TankField.js
git commit -m "feat(factory): add TankField with per-instance roughness/metalness"
```

---

## Task 8: Flybar + FlybarPool

**Files:**
- Create: `src/world/factory/entities/Flybar.js`

**Step 1:** 写入：

```js
import * as THREE from 'three/webgpu'

export class Flybar {
  /**
   * @param {number} id
   * @param {THREE.Object3D} prototypeScene
   */
  constructor(id, prototypeScene) {
    this.id = id
    this.root = prototypeScene.clone(true)
    this.root.name = `Flybar-${id}`
  }

  dispose() {
    // GLB geometry/material/texture belong to Resources; Flybar only removes its clone.
    this.root.parent?.remove(this.root)
  }
}

export class FlybarPool {
  /**
   * @param {THREE.Object3D} prototypeScene
   * @param {number} count
   */
  constructor(prototypeScene, count) {
    this.flybars = []
    for (let i = 0; i < count; i++) {
      this.flybars.push(new Flybar(i, prototypeScene))
    }
  }

  get(id) { return this.flybars[id] }

  dispose() { this.flybars.forEach((f) => f.dispose()) }
}
```

**Step 2:** Commit

```powershell
git add src/world/factory/entities/Flybar.js
git commit -m "feat(factory): add Flybar + FlybarPool"
```

---

## Task 9: Crane 类骨架（构造 + 子 Object3D + 静态 bbox）

**Files:**
- Create: `src/world/factory/entities/Crane.js`

**Step 1:** 写入骨架（只覆盖构造与可视，方法在 Task 10/11 补全）：

```js
import * as THREE from 'three/webgpu'
import gsap from 'gsap'
import { FACTORY_CONFIG, FLYBAR_CRANE_Y } from '../config.js'
import { createCraneMaterial } from '../materials/createCraneMaterial.js'
import { createLabelPlane, drawLabel, drawTrack } from '../labels/createLabelPlane.js'

export default class Crane {
  /** @type {THREE.Box3 | null} */
  static staticBBox = null

  /**
   * @param {{
   *   id: string,
   *   prototypeScene: THREE.Object3D,
   *   state: any,
   *   initialPosition: THREE.Vector3
   * }} opts
   */
  constructor({ id, prototypeScene, state, initialPosition }) {
    this.id = id
    this.state = state
    this.flybar = null
    this.tl = null

    this.root = new THREE.Group()
    this.root.name = `Crane-${id}`
    this.root.position.copy(initialPosition)

    this.visual = prototypeScene.clone(true)
    this.root.add(this.visual)

    if (!Crane.staticBBox) {
      Crane.staticBBox = new THREE.Box3().setFromObject(this.visual)
    }
    const bbox = Crane.staticBBox
    const center = bbox.getCenter(new THREE.Vector3())

    this._baseMap = pickFirstMap(this.visual)
    const origPbr = pickFirstPbr(this.visual)
    this.material = createCraneMaterial(this._baseMap, {
      modeColor: FACTORY_CONFIG.modeColors[state.mode] ?? '#cccccc',
      metalness: origPbr?.metalness ?? 0.4,
      roughness: origPbr?.roughness ?? 0.6
    })
    this.visual.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true
        c.receiveShadow = true
        c.material = this.material
      }
    })

    this.flybarMount = new THREE.Object3D()
    this.flybarMount.name = 'flybarMount'
    this.flybarMount.position.set(0, FLYBAR_CRANE_Y - this.root.position.y, 0)
    this.root.add(this.flybarMount)

    const labelLeft  = createLabelPlane({ width: 6, height: 6, draw: drawLabel })
    const labelRight = createLabelPlane({ width: 6, height: 6, draw: drawLabel })
    labelLeft.mesh.position.set(bbox.min.x, center.y, center.z)
    labelLeft.mesh.rotation.y = Math.PI / 2
    labelRight.mesh.position.set(bbox.max.x, center.y, center.z)
    labelRight.mesh.rotation.y = -Math.PI / 2
    this.root.add(labelLeft.mesh, labelRight.mesh)
    this.labelLeft = labelLeft
    this.labelRight = labelRight

    const trackPlane = createLabelPlane({
      width: 12, height: 3, canvasW: 512, canvasH: 128, draw: drawTrack
    })
    trackPlane.mesh.position.set(center.x, bbox.max.y + 6, center.z)
    this.root.add(trackPlane.mesh)
    this.trackPlane = trackPlane

    this.setLabel(state.labelText)
    this.setTrack(state.trackText)
  }

  setLabel(text) {
    this.labelLeft.setText(text)
    this.labelRight.setText(text)
    this.state.labelText = text
  }

  setTrack(text) {
    this.trackPlane.setText(text)
    this.state.trackText = text
  }

  update() {
    this.labelLeft.setText(this.state.labelText)
    this.labelRight.setText(this.state.labelText)
    this.trackPlane.setText(this.state.trackText)
  }

  dispose() {
    this.tl?.kill()
    this.labelLeft.dispose()
    this.labelRight.dispose()
    this.trackPlane.dispose()
    // GLB geometry/texture belong to Resources; Crane owns only the replacement material and labels.
    this.material?.dispose()
    this.root.parent?.remove(this.root)
  }
}

function pickFirstMap(root) {
  let map = null
  root.traverse((c) => {
    if (!map && c.isMesh) {
      const m = Array.isArray(c.material) ? c.material[0] : c.material
      if (m?.map) map = m.map
    }
  })
  return map
}

function pickFirstPbr(root) {
  let pbr = null
  root.traverse((c) => {
    if (!pbr && c.isMesh) {
      const m = Array.isArray(c.material) ? c.material[0] : c.material
      if (m && ('metalness' in m || 'roughness' in m)) pbr = m
    }
  })
  return pbr
}
```

**Step 2:** Commit

```powershell
git add src/world/factory/entities/Crane.js
git commit -m "feat(factory): add Crane class skeleton (visual + labels + bbox)"
```

---

## Task 10: Crane 行为方法（move / pick / drop / setMode）

**Files:**
- Modify: `src/world/factory/entities/Crane.js`

**Step 1:** 在 `Crane` 类内、`update()` 之前追加：

```js
moveToX(targetX, { duration, ease = 'power2.inOut' } = {}) {
  const dx = Math.abs(targetX - this.root.position.x)
  const dur = duration ?? Math.max(0.4, dx / 12)
  return new Promise((resolve) => {
    this.tl?.kill()
    this.tl = gsap.timeline({
      onUpdate: () => { this.state.x = this.root.position.x },
      onComplete: () => {
        this.state.x = this.root.position.x
        resolve()
      }
    })
    this.tl.to(this.root.position, { x: targetX, duration: dur, ease })
  })
}

pickFlybar(flybar) {
  if (this.flybar) {
    console.warn(`[Crane] ${this.id} already has flybar ${this.flybar.id}, replacing with ${flybar.id}`)
  }
  this.flybarMount.attach(flybar.root)
  this.flybar = flybar
  return new Promise((resolve) => {
    gsap.to(flybar.root.position, {
      x: 0, y: 0, z: 0, duration: 0.6, ease: 'power2.out',
      onComplete: resolve
    })
  })
}

dropFlybar(targetAnchor) {
  if (!this.flybar) return Promise.resolve()
  const flybar = this.flybar
  targetAnchor.attach(flybar.root)
  return new Promise((resolve) => {
    gsap.to(flybar.root.position, {
      x: 0, y: 0, z: 0, duration: 0.6, ease: 'power2.in',
      onComplete: () => {
        this.flybar = null
        resolve()
      }
    })
  })
}

setMode(mode) {
  this.state.mode = mode
  const hex = FACTORY_CONFIG.modeColors[mode]
  if (!hex) return
  const target = new THREE.Color(hex)
  const u = this.material.userData.modeColor
  gsap.to(u.value, { r: target.r, g: target.g, b: target.b, duration: 0.4 })
}
```

**Step 2:** 顶部 `import` 已含 `gsap` / `FACTORY_CONFIG`，无需额外。

**Step 3:** Commit

```powershell
git add src/world/factory/entities/Crane.js
git commit -m "feat(factory): add Crane move/pick/drop/setMode behaviors"
```

---

## Task 11: FactoryController（1Hz tick + 任务派发 + 视觉编排）

**Files:**
- Create: `src/world/factory/FactoryController.js`

**Step 1:** 写入：

```js
import { FACTORY_CONFIG } from './config.js'

const NEXT_MODE = { auto: 'manual', manual: 'maintenance', maintenance: 'auto' }

export default class FactoryController {
  /**
   * @param {ReturnType<typeof import('./state/FactoryState.js').createFactoryState>} state
   * @param {Map<string, import('./entities/Crane.js').default>} cranesById
   * @param {import('./entities/Flybar.js').FlybarPool} flybarPool
   * @param {import('./entities/TankField.js').default} tankField
   */
  constructor(state, cranesById, flybarPool, tankField) {
    this.state = state
    this.cranes = cranesById
    this.flybarPool = flybarPool
    this.tankField = tankField

    this._acc = 0
    this._modeAcc = 0
    this._paused = false
    this._reservedTanks = new Set()
    this._reservedFlybars = new Set()
  }

  pause()  { this._paused = true }
  resume() { this._paused = false }

  update(dt) {
    if (this._paused) return
    this._acc += dt * 1000
    this._modeAcc += dt * 1000

    if (this._acc >= FACTORY_CONFIG.sim.tickMs) {
      this._acc = 0
      this._tick()
    }
    if (this._modeAcc >= FACTORY_CONFIG.sim.modeRotateMs) {
      this._modeAcc = 0
      this._rotateRandomMode()
    }
  }

  _tick() {
    for (const cs of this.state.cranes) {
      if (cs.status !== 'idle' || cs.task) continue
      const task = this._draftTask()
      if (!task) continue

      cs.task = task
      cs.status = 'moving'
      cs.trackText = '前行'
      this._reservedFlybars.add(task.flybarId)
      this._reservedTanks.add(task.toTankId)

      this._runCraneTask(cs).catch((err) => {
        console.warn(`[FactoryController] crane ${cs.id} task failed`, err)
        cs.status = 'idle'
        cs.trackText = '待机'
        cs.carryingFlybarId = null
        this._releaseTask(cs)
      })
    }
  }

  _draftTask() {
    const tanks = this.state.tanks
    const candidates = []
    for (const t of tanks) {
      if (t.occupiedFlybarId == null) continue
      if (this._reservedFlybars.has(t.occupiedFlybarId)) continue
      candidates.push(t.id)
    }
    if (!candidates.length) return null
    const fromTankId = candidates[Math.floor(Math.random() * candidates.length)]
    const flybarId = tanks[fromTankId].occupiedFlybarId

    const empties = []
    for (const t of tanks) {
      if (t.id === fromTankId) continue
      if (t.occupiedFlybarId != null) continue
      if (this._reservedTanks.has(t.id)) continue
      empties.push(t.id)
    }
    if (!empties.length) return null
    const toTankId = empties[Math.floor(Math.random() * empties.length)]
    return { fromTankId, toTankId, flybarId }
  }

  async _runCraneTask(cs) {
    const crane = this.cranes.get(cs.id)
    if (!crane) return this._releaseTask(cs)
    const { fromTankId, toTankId, flybarId } = cs.task
    const fromTank = this.state.tanks[fromTankId]
    const toTank   = this.state.tanks[toTankId]
    if (fromTank.occupiedFlybarId !== flybarId) return this._releaseTask(cs)
    const flybar = this.flybarPool.get(flybarId)

    await crane.moveToX(fromTank.x)
    cs.status = 'picking';   cs.trackText = '取飞杆'
    await crane.pickFlybar(flybar)
    fromTank.occupiedFlybarId = null
    cs.carryingFlybarId = flybarId
    this.state.flybars[flybarId].location = { kind: 'crane', craneId: cs.id }

    cs.status = 'carrying';  cs.trackText = '后退'
    await crane.moveToX(toTank.x)

    cs.status = 'dropping';  cs.trackText = '下飞杆'
    await crane.dropFlybar(this.tankField.getAnchor(toTankId))
    toTank.occupiedFlybarId = flybarId
    cs.carryingFlybarId = null
    this.state.flybars[flybarId].location = { kind: 'tank', tankId: toTankId }

    cs.status = 'idle'; cs.trackText = '待机'
    this._releaseTask(cs)
  }

  _releaseTask(cs) {
    if (!cs.task) return
    this._reservedFlybars.delete(cs.task.flybarId)
    this._reservedTanks.delete(cs.task.toTankId)
    cs.task = null
  }

  _rotateRandomMode() {
    const cs = this.state.cranes[Math.floor(Math.random() * this.state.cranes.length)]
    const next = NEXT_MODE[cs.mode] ?? 'auto'
    cs.mode = next
    this.state.emit('mode-changed', { id: cs.id, mode: next })
    const crane = this.cranes.get(cs.id)
    crane?.setMode(next)
  }
}
```

**Step 2:** Commit

```powershell
git add src/world/factory/FactoryController.js
git commit -m "feat(factory): add FactoryController task orchestration"
```

---

## Task 12: Factory 组合根

**Files:**
- Create: `src/world/factory/Factory.js`

**Step 1:** 写入：

```js
import * as THREE from 'three/webgpu'
import { createFactoryState } from './state/FactoryState.js'
import FactoryController from './FactoryController.js'
import Rails from './entities/Rails.js'
import TankField from './entities/TankField.js'
import { FlybarPool } from './entities/Flybar.js'
import Crane from './entities/Crane.js'
import { FACTORY_CONFIG } from './config.js'

export default class Factory {
  /**
   * @param {{
   *   craneScene: THREE.Object3D,
   *   flybarScene: THREE.Object3D,
   *   tankBoxScene: THREE.Object3D,
   *   railwayScene: THREE.Object3D
   * }} resources
   */
  constructor({ craneScene, flybarScene, tankBoxScene, railwayScene }) {
    this.root = new THREE.Group()
    this.root.name = 'Factory'

    this.state = createFactoryState()

    this.rails = new Rails(railwayScene)
    this.root.add(this.rails.root)

    this.tankField = new TankField(tankBoxScene, this.state.tanks)
    this.root.add(this.tankField.root)

    this.flybarPool = new FlybarPool(flybarScene, this.state.flybars.length)

    this.cranes = new Map()
    for (const cs of this.state.cranes) {
      const cfg = FACTORY_CONFIG.cranes.find((c) => c.id === cs.id)
      const crane = new Crane({
        id: cs.id,
        prototypeScene: craneScene,
        state: cs,
        initialPosition: new THREE.Vector3(cfg?.initialX ?? 0, cfg?.initialY ?? 0, cfg?.initialZ ?? 0)
      })
      this.cranes.set(cs.id, crane)
      this.root.add(crane.root)
    }

    for (const fb of this.state.flybars) {
      if (fb.location.kind === 'tank') {
        const anchor = this.tankField.getAnchor(fb.location.tankId)
        const flybar = this.flybarPool.get(fb.id)
        anchor.add(flybar.root)
        flybar.root.position.set(0, 0, 0)
      }
    }

    for (const cs of this.state.cranes) {
      const crane = this.cranes.get(cs.id)
      crane.setMode(cs.mode)
    }

    this.controller = new FactoryController(this.state, this.cranes, this.flybarPool, this.tankField)
  }

  update(dt) {
    this.controller.update(dt)
    for (const c of this.cranes.values()) c.update(dt)
    this.tankField.update?.(dt)
  }

  dispose() {
    this.controller.pause()
    for (const c of this.cranes.values()) c.dispose()
    this.cranes.clear()
    this.tankField?.dispose()
    this.rails?.dispose()
    this.flybarPool?.dispose()
    this.root.parent?.remove(this.root)
  }
}
```

**Step 2:** Commit

```powershell
git add src/world/factory/Factory.js
git commit -m "feat(factory): add Factory composition root"
```

---

## Task 13: 重构 `world.js` 接入 Factory

**Files:**
- Modify: `src/world/world.js`
- Modify: `src/app/Experience.js:79-84`

**Step 1:** 改写 `src/world/world.js`：

```js
import * as THREE from 'three/webgpu'
import { eventBus } from '../utils/event-bus.js'
import Factory from './factory/Factory.js'

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        /** @type {Factory | null} */
        this.factory = null
        /** @type {THREE.Object3D | null} */
        this.model = null

        eventBus.on('source ready', () => {
            const items = this.experience.resources?.items
            const craneScene   = items?.craneModel?.scene
            const flybarScene  = items?.flybarModel?.scene
            const tankBoxScene = items?.tankBoxModel?.scene
            const railwayScene = items?.railwayModel?.scene

            if (!craneScene || !flybarScene || !tankBoxScene || !railwayScene) {
                const detail = {
                    crane: !!craneScene,
                    flybar: !!flybarScene,
                    tank: !!tankBoxScene,
                    railway: !!railwayScene
                }
                console.error('[World] missing required factory glbs', detail)
                throw new Error('[World] missing required factory glbs')
            }

            this.factory = new Factory({ craneScene, flybarScene, tankBoxScene, railwayScene })
            this.scene.add(this.factory.root)

            this.model = this.factory.root
            this._frameCameraToFactory()
        })
    }

    _frameCameraToFactory() {
        if (!this.factory) return
        const camera = this.experience.worldCamera.instance
        const controls = this.experience.worldCamera.controls

        const box = new THREE.Box3().setFromObject(this.factory.root)
        if (box.isEmpty()) return

        const center = box.getCenter(new THREE.Vector3())
        const sphere = box.getBoundingSphere(new THREE.Sphere())

        const padding = 1.35
        const fovRad = THREE.MathUtils.degToRad(camera.fov)
        const distance = (sphere.radius / Math.sin(fovRad / 2)) * padding

        const offset = new THREE.Vector3(1, 0.55, 1).normalize().multiplyScalar(distance)
        camera.position.copy(center).add(offset)
        camera.near = Math.max(0.01, sphere.radius / 100)
        camera.far  = Math.max(500, sphere.radius * 50)
        camera.updateProjectionMatrix()

        controls.target.copy(center)
        controls.maxDistance = Math.max(sphere.radius * 20, distance * 4)
        controls.update()
    }

    /** @param {number} dt seconds */
    update(dt) {
        this.factory?.update(dt ?? 0)
    }

    dispose() {
        this.factory?.dispose()
        this.factory = null
        this.model = null
    }
}
```

**Step 2:** 修改 `src/app/Experience.js` 中的 `update`，把 `dt` 传进 `world.update`：

```js
update(timestamp) {
    this.time.update(timestamp)
    this.worldCamera.update()
    this.world.update(this.time.getDelta())
    this.renderer.render()
}
```

**Step 3:** 启动 dev server 验证：

```powershell
pnpm dev
```

打开浏览器：
- 控制台无报错
- 场景中能看到 3 台 crane（编号 A/B/C 显示在两侧 plane）+ 2 条 `railway.glb` 钢轨 + 1 行 40 个方形槽
- 槽阵列只产生 1 个 InstancedMesh，且 `factory.tankField.mesh.count === 40`
- 两条钢轨世界坐标分别为 `(0, 15, -26)` 与 `(0, 15, 26)`
- 等待 ~1s 后能看到天车只沿 X 轴水平移动；飞杆在槽上落点为 `(tank.x, -8, tank.z)`，在天车上挂点为 `(crane.x, 12, crane.z)`；轨迹文字依次切换 `前行/取飞杆/后退/下飞杆/待机`
- 等待 ~15s 能看到某台天车颜色平滑切换

**Step 4:** Commit

```powershell
git add src/world/world.js src/app/Experience.js
git commit -m "refactor(world): replace inline craneModel handling with Factory"
```

---

## Task 14: 验收清单走查

**Files:** —

**Step 1:** 按设计文档 §5.4 手测清单逐项检查：

| # | 项 | 通过？ |
|---|---|---|
| 1 | 3 台 crane 编号 A/B/C 可见 | ☐ |
| 2 | 槽阵列为 1 行 40 个，单 InstancedMesh，`mesh.count === 40` | ☐ |
| 3 | 槽 roughness/metalness 抖动可见 | ☐ |
| 4 | setMode 平滑过渡 + 贴图保留 | ☐ |
| 5 | 两条 railway 模型位于 `(0,15,-26)` / `(0,15,26)` | ☐ |
| 6 | 天车只沿 X 轴移动到目标槽 `x`，不改 Y/Z | ☐ |
| 7 | 飞杆取放高度正确：槽上 Y=-8，天车上 Y=12，无额外 rotation/scale | ☐ |
| 8 | 任务流转 4 段 + 文本切换 | ☐ |
| 9 | `FactoryController` 任务 reservation 不泄漏，`flybars[id].location` 随取放同步更新 | ☐ |
| 10 | trackText 不变帧无 needsUpdate | ☐ |
| 11 | dispose 不重复释放 GLB 共享 geometry/material/texture，不报错 | ☐ |

**Step 2:** 任一项失败：在对应 Task 上回滚或追加修复 commit；不混入新功能。

**Step 3:** 所有项通过后：

```powershell
git log --oneline -20
```

确认 commit 链清晰，准备开 PR / 合并。

---

## Out-of-scope（明确不做）

- 槽液位 / 告警 / 槽编号显示
- 飞杆/天车碰撞、避障、多机排队
- TSL 状态高亮（呼吸光等）
- 后台数据接入（PollingAdapter）
- 单元测试

均通过现有架构留有插入点，参见设计文档 §5.5。
