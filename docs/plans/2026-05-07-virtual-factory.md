# 虚拟工厂可视化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `src/world/world.js` 中直接处理 `craneModel` 的逻辑抽离为可复例化的 `Crane` 组件，配合 `TankField`（InstancedMesh）/`Rails`/`Flybar`，并以本地仿真（1Hz tick）驱动状态机，构建未来可平滑切换为短轮询后台的可视化架构。

**Architecture:** 单向数据流 `FactorySim → FactoryState → 视觉层`；视觉层只读状态、用 gsap 自插值；状态层不持有 Three.js 引用；后续接后台只换 Sim 为 PollingAdapter。详见 [`2026-05-07-virtual-factory-design.md`](./2026-05-07-virtual-factory-design.md)。

**Tech Stack:** Three.js 0.183 (`three/webgpu` + `three/tsl`)、gsap 3.15、mitt 3、Vite 5。

**Testing strategy:** 当前项目无测试框架，且场景以视觉为主。每个任务的「验证」改为：① `npm run dev` 启动；② 浏览器打开 `http://localhost:5173`；③ 控制台无报错；④ 视觉/DevTools Stats 满足任务声明的检查项。验收清单见设计文档 §5.4。

**Asset prerequisites（开始本计划前由用户提供）：**
- `public/model/flybar.glb`：单根飞杆模型
- `public/model/box.glb`：方形药剂槽（已有约定，请确认存在）
- `public/model/crane.glb`：现有

如启动时缺资源：在控制台 `warn` 后早退，不阻塞场景。

---

## Task 0: 基线确认

**Files:** —

**Step 1:** 安装依赖、启动开发服务器

```powershell
pnpm install
pnpm dev
```

**Step 2:** 浏览器打开 `http://localhost:5173`，确认现有 `crane.glb` 已能渲染、控制台无报错。

**Step 3:** 确认 `public/model/flybar.glb` 与 `public/model/box.glb` 存在：

```powershell
Get-ChildItem public/model
```

期望输出至少包含 `crane.glb`、`flybar.glb`、`box.glb`。如缺失则停止本计划等待美术补齐。

**Step 4:** 创建工作分支（如未在隔离 worktree 中）

```powershell
git checkout -b feat/virtual-factory
```

**Commit:** —（无代码改动）

---

## Task 1: 资源清单扩展

**Files:**
- Modify: `src/sources.js`

**Step 1:** 在 `src/sources.js` 末尾追加两条资源：

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
git commit -m "feat(sources): add flybar and tank box model entries"
```

---

## Task 2: Factory 配置常量

**Files:**
- Create: `src/world/factory/config.js`

**Step 1:** 创建文件并写入：

```js
import * as THREE from 'three/webgpu'

/**
 * 工厂布局常量。所有数值仅用于本地仿真展示，
 * 后续接入后台时由 PollingAdapter 写入 FactoryState 覆盖。
 */
export const FACTORY_CONFIG = {
  rails: {
    yLevel: 15,
    z: [-27, 25],
    length: 200,
    radius: 0.25
  },
  tanks: {
    rows: 2,
    cols: 20,
    spacingX: 5,
    rowZ: [-15, 15],
    originX: -47.5,
    baseRoughness: 0.6,
    baseMetalness: 0.4,
    jitter: 0.2
  },
  cranes: [
    { id: 'A', initialX: -30, mode: 'auto' },
    { id: 'B', initialX: 0,   mode: 'manual' },
    { id: 'C', initialX: 30,  mode: 'maintenance' }
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

export const TANK_ANCHOR_Y_OFFSET = 4
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
 *                   task: { fromTankId: number, toTankId: number } | null }>,
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

## Task 6: Rails 实体

**Files:**
- Create: `src/world/factory/entities/Rails.js`

**Step 1:** 写入：

```js
import * as THREE from 'three/webgpu'
import { FACTORY_CONFIG } from '../config.js'

export default class Rails {
  constructor() {
    const { yLevel, z, length, radius } = FACTORY_CONFIG.rails
    this.root = new THREE.Group()
    this.root.name = 'Rails'

    const geom = new THREE.CylinderGeometry(radius, radius, length, 16)
    geom.rotateZ(Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.9, roughness: 0.4 })

    for (const zPos of z) {
      const m = new THREE.Mesh(geom, mat)
      m.position.set(0, yLevel, zPos)
      m.castShadow = true
      m.receiveShadow = true
      this.root.add(m)
    }

    this._geom = geom
    this._mat = mat
  }

  dispose() {
    this._geom.dispose()
    this._mat.dispose()
    this.root.parent?.remove(this.root)
  }
}
```

**Step 2:** Commit

```powershell
git add src/world/factory/entities/Rails.js
git commit -m "feat(factory): add Rails entity (two cylinder rails)"
```

---

## Task 7: TankField（InstancedMesh + per-instance 抖动）

**Files:**
- Create: `src/world/factory/entities/TankField.js`

**Step 1:** 写入：

```js
import * as THREE from 'three/webgpu'
import { FACTORY_CONFIG, TANK_ANCHOR_Y_OFFSET } from '../config.js'
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
      console.warn('[TankField] box.glb contains no mesh, abort')
      return
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
      anchor.position.set(t.x, TANK_ANCHOR_Y_OFFSET, t.z)
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
    this.root.traverse((c) => {
      if (c.isMesh) {
        c.geometry?.dispose()
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        mats.forEach((m) => m?.dispose?.())
      }
    })
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
import { FACTORY_CONFIG } from '../config.js'
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
    this.flybarMount.position.copy(center)
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
    this.visual.traverse((c) => {
      if (c.isMesh) c.geometry?.dispose()
    })
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
    this.tl = gsap.timeline({ onComplete: resolve })
    this.tl.to(this.root.position, { x: targetX, duration: dur, ease })
  })
}

pickFlybar(flybar) {
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
  return new Promise((resolve) => {
    gsap.to(flybar.root.position, {
      y: -1, duration: 0.6, ease: 'power2.in',
      onComplete: () => {
        targetAnchor.attach(flybar.root)
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

## Task 11: FactorySim（1Hz tick + 任务派发 + Crane 状态机驱动）

**Files:**
- Create: `src/world/factory/state/FactorySim.js`

**Step 1:** 写入：

```js
import { FACTORY_CONFIG } from '../config.js'

const NEXT_MODE = { auto: 'manual', manual: 'maintenance', maintenance: 'auto' }

export default class FactorySim {
  /**
   * @param {ReturnType<typeof import('./FactoryState.js').createFactoryState>} state
   * @param {Map<string, import('../entities/Crane.js').default>} cranesById
   * @param {import('../entities/Flybar.js').FlybarPool} flybarPool
   * @param {import('../entities/TankField.js').default} tankField
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
      this._reservedFlybars.add(this._flybarOnTank(task.fromTankId))
      this._reservedTanks.add(task.toTankId)

      this._runCraneTask(cs).catch((err) => {
        console.warn(`[FactorySim] crane ${cs.id} task failed`, err)
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

    const empties = []
    for (const t of tanks) {
      if (t.id === fromTankId) continue
      if (t.occupiedFlybarId != null) continue
      if (this._reservedTanks.has(t.id)) continue
      empties.push(t.id)
    }
    if (!empties.length) return null
    const toTankId = empties[Math.floor(Math.random() * empties.length)]
    return { fromTankId, toTankId }
  }

  _flybarOnTank(tankId) {
    return this.state.tanks[tankId].occupiedFlybarId
  }

  async _runCraneTask(cs) {
    const crane = this.cranes.get(cs.id)
    if (!crane) return this._releaseTask(cs)
    const { fromTankId, toTankId } = cs.task
    const fromTank = this.state.tanks[fromTankId]
    const toTank   = this.state.tanks[toTankId]
    const flybarId = fromTank.occupiedFlybarId
    if (flybarId == null) return this._releaseTask(cs)
    const flybar = this.flybarPool.get(flybarId)

    await crane.moveToX(fromTank.x)
    cs.status = 'picking';   cs.trackText = '取飞杆'
    await crane.pickFlybar(flybar)
    fromTank.occupiedFlybarId = null
    cs.carryingFlybarId = flybarId

    cs.status = 'carrying';  cs.trackText = '后退'
    await crane.moveToX(toTank.x)

    cs.status = 'dropping';  cs.trackText = '下飞杆'
    await crane.dropFlybar(this.tankField.getAnchor(toTankId))
    toTank.occupiedFlybarId = flybarId
    cs.carryingFlybarId = null

    cs.status = 'idle'; cs.trackText = '待机'
    this._releaseTask(cs)
  }

  _releaseTask(cs) {
    if (!cs.task) return
    this._reservedFlybars.delete(this._flybarOnTank(cs.task.fromTankId))
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
git add src/world/factory/state/FactorySim.js
git commit -m "feat(factory): add FactorySim (1Hz tick state machine)"
```

---

## Task 12: Factory 组合根

**Files:**
- Create: `src/world/factory/Factory.js`

**Step 1:** 写入：

```js
import * as THREE from 'three/webgpu'
import { createFactoryState } from './state/FactoryState.js'
import FactorySim from './state/FactorySim.js'
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
   *   tankBoxScene: THREE.Object3D
   * }} resources
   */
  constructor({ craneScene, flybarScene, tankBoxScene }) {
    this.root = new THREE.Group()
    this.root.name = 'Factory'

    this.state = createFactoryState()

    this.rails = new Rails()
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
        initialPosition: new THREE.Vector3(cfg?.initialX ?? 0, FACTORY_CONFIG.rails.yLevel, 0)
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

    this.sim = new FactorySim(this.state, this.cranes, this.flybarPool, this.tankField)
  }

  update(dt) {
    this.sim.update(dt)
    for (const c of this.cranes.values()) c.update(dt)
    this.tankField.update?.(dt)
  }

  dispose() {
    this.sim.pause()
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

            if (!craneScene || !flybarScene || !tankBoxScene) {
                console.warn('[World] missing factory glbs, abort factory build', {
                    crane: !!craneScene, flybar: !!flybarScene, tank: !!tankBoxScene
                })
                return
            }

            this.factory = new Factory({ craneScene, flybarScene, tankBoxScene })
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
- 场景中能看到 3 台 crane（编号 A/B/C 显示在两侧 plane）+ 钢轨 + 大批方形槽
- 槽阵列只产生 1 个 InstancedMesh：在 console 跑 `_e = window` （或临时把 factory 暴露到 window 检查 `factory.tankField.mesh.count`）
- 等待 ~1s 后能看到天车开始水平移动，飞杆下放、转移；轨迹文字依次切换 `前行/取飞杆/后退/下飞杆/待机`
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
| 1 | 多台 crane 编号可见 | ☐ |
| 2 | 槽阵列单 InstancedMesh | ☐ |
| 3 | 槽 roughness/metalness 抖动可见 | ☐ |
| 4 | setMode 平滑过渡 + 贴图保留 | ☐ |
| 5 | 任务流转 4 段 + 文本切换 | ☐ |
| 6 | trackText 不变帧无 needsUpdate | ☐ |
| 7 | dispose 不报错 | ☐ |

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
