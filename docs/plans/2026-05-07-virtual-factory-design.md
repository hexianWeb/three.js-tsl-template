# 虚拟工厂可视化架构设计（Crane / Tank / Flybar）

日期：2026-05-07
范围：把现有 `src/world/world.js` 中直接处理 `craneModel` 的逻辑抽离为可复例化组件，配合 `TankField`、`Rails`（`railway.glb` 双实例）、`Flybar`，构建一套以**本地仿真**驱动、未来可平滑切换为**短轮询后台接口**的工厂可视化架构。

---

## 0. 已确认前提

| 维度 | 决定 |
|---|---|
| 数据来源 | 仅本地仿真（暂不接后台），未来接入方式 = 1s 短轮询 HTTP |
| 飞杆 | 独立 `flybar.glb`，每天车至多 1 根（有/无二元） |
| GLB 约定 | Blender 侧已处理 forward / up / origin / scale；运行时代码不做 scale，不额外调整 rotation |
| 模式色 | TSL 节点材质，全机统一 tint，`final = base * mix(1, modeColor, tintStrength)`，`tintStrength` 默认 0.5，原纹理仍可辨 |
| 状态高亮（呼吸光等） | 不在本期范围 |
| 文字/图标 | CanvasTexture：编号 6×6 plane 贴 bbox 左右两侧；轨迹文字 plane 贴 bbox 上方 6m |
| 天车体积 | 所有天车一致、不变 → 一次 bbox 计算后缓存复用 |
| 槽体 | `box.glb` 单 mesh → InstancedMesh；1 行 40 个，X 向宽度 `8.57`，步距 `8.57 * 1.2 = 10.284`；per-instance roughness/metalness ±0.2 抖动（TSL `attribute()`） |
| 钢轨 | 使用 `railway.glb`，双实例放置在 `(0,15,-26)` / `(0,15,26)` |
| 飞杆动作 | 程序化补间，统一用 gsap（项目已集成 3.15）|
| 飞杆挂点 | 槽上世界坐标 `(tank.x, -8, tank.z)`；天车上世界坐标 `(crane.x, 12, crane.z)`；只插值位置，不额外改 rotation/scale |
| 资源失败 | 本期所有资源都应存在；缺失或不可用直接 `console.error` / throw，尽早暴露问题 |
| 资源所有权 | GLB geometry/material/texture 归 `Resources`；实体只释放自己创建的 label texture、替换材质、容器引用 |
| 测试 | 无单测；以手测清单验证 |

---

## §1 架构总览

### 1.1 数据流

```
┌───────────────────┐   mutate    ┌────────────────┐
│ FactoryController │ ──────────▶ │  FactoryState  │
│ 1Hz tick + 编排    │             │ (纯 JS 数据)    │
└─────────┬─────────┘             └────────────────┘
          │ orchestrate
          ▼
┌──────────────────────────────────────────────┐
│ 视觉实体（Crane / Flybar / TankField / Rails） │
│ Three.js 对象、材质、label、gsap 动画           │
└──────────────────────────────────────────────┘
          ▲
          │ update(dt) 由 Experience 主循环驱动
```

- `FactoryState` 保持纯 JS 对象，不持有 Three.js 引用。
- 本期接受 `FactoryController` 同时做本地仿真派单和 Crane/Flybar 动画编排，避免把还未接后台的状态机拆得过早。
- 视觉实体仍只负责自身 Three.js 对象、材质、label 和局部动画方法，不决策任务来源。
- 后续接后台：新增 `PollingAdapter`（`fetch('/api/state')` 每 1s 合并到 `FactoryState`），再按实际接口决定是否保留 `FactoryController` 的本地派单部分。

### 1.2 目录结构

```
src/world/
  world.js                    // 瘦身为：构造 Factory + 镜头框选
  factory/
    Factory.js                // 组合根：Rails / TankField / Crane[] / FlybarPool
    FactoryController.js      // 本地仿真派单 + Crane/Flybar 视觉编排
    config.js                 // 布局常量（钢轨位置、槽阵列、天车数、初始位置等）
    entities/
      Crane.js                // 单天车视觉 + 行为（move/pick/drop）
      Flybar.js               // 飞杆视觉
      TankField.js            // 槽 InstancedMesh
      Rails.js                // railway.glb 双实例钢轨
    materials/
      createCraneMaterial.js  // TSL: base × mix(1, modeColor, tintStrength)
      createTankMaterial.js   // TSL: per-instance roughness/metalness
    labels/
      createLabelPlane.js     // CanvasTexture 工厂（编号 / 轨迹通用）
    state/
      FactoryState.js         // 状态容器 + mitt 订阅
```

### 1.3 模块职责

| 模块 | 职责 | 不做 |
|---|---|---|
| `Factory` | 资源就绪后构建所有视觉实体，串联 controller 与 state | 不写仿真规则，不写动画细节 |
| `FactoryController` | 1Hz 本地派单、reservation、状态同步、调用 Crane/Flybar 动画方法 | 不创建 Three.js mesh/material |
| `Crane` | 1 台天车的视觉 + 1 个 Flybar 槽位；提供 `move/pick/drop/setMode` 方法 | 不决策"该去哪个槽" |
| `Flybar` | 单根飞杆视觉；被 Crane 抓取/释放（reparent + 位置插值） | 不持有逻辑状态 |
| `TankField` | 单 InstancedMesh，按 config 一次性铺出 1 行 40 个槽 | 暂不画液位 |
| `Rails` | 克隆 `railway.glb`，生成 2 条静态导轨 | 不用代码生成几何体 |
| `FactoryState` | 普通对象 + mitt 事件 | 不依赖 Three.js |
| `createCraneMaterial` | 接收 baseMap，返回带 `modeColor / tintStrength` uniform 的节点材质 | — |
| `createTankMaterial` | 用 `attribute('aRough'/'aMetal')` 与基础值组合 | — |

### 1.4 接入 `Experience`

`World` 内部 `new Factory(this.experience)`，`update(dt)` 调用顺序：
1. `factory.controller.update(dt)` → 推进本地派单和动画编排（内部 1Hz 节流）
2. `factory.update(dt)` → 视觉层逐 entity 更新（文本节流 + 边界守护）

资源未加载完时 `factory == null`，`update` 早退。资源加载完成后若缺少必要 GLB，则直接报错并停止构建。

---

## §2 `Crane` 类 API

### 2.1 构造

```js
new Crane({
  id,                  // 'A' | 'B' | 'C' | ...
  prototypeScene,      // 已 clone 的 crane scene
  state,               // FactoryState 中本天车的状态对象引用
  initialPosition,     // THREE.Vector3
})
```

不感知 Experience / 相机 / 渲染器。

### 2.2 子 Object3D 布局

```
root (Group)
 ├── visual           // = clone 的 crane scene；统一 TSL material
 ├── flybarMount      // Object3D，使飞杆挂载后的世界 Y = 12
 │     └── (Flybar.root 在 pick 后挂这里，local y=0)
 ├── labelLeft        // 6×6 plane, 贴 bbox 左侧, rotation.y = +π/2
 ├── labelRight       // 6×6 plane, 贴 bbox 右侧, rotation.y = -π/2
 └── trackLabel       // plane, 位于 bbox top + 6m
```

`Crane.staticBBox` 静态字段：第一台天车构造时计算，后续复用。

### 2.3 公有方法

```js
moveToX(targetX, { duration, ease } = {})    // 只沿 X 轴平移；返回 Promise
pickFlybar(flybar)                            // attach flybar 到 mount，local position → (0,0,0)，世界 Y = 12
dropFlybar(targetAnchor)                      // attach flybar 到槽 anchor，local position → (0,0,0)，世界 Y = -8
setMode(mode)                                 // gsap 渐变 modeColor.value
setLabel(text)                                // 重画编号 CanvasTexture
setTrack(text)                                // 重画轨迹 CanvasTexture
update(dt)                                    // 文本节流 + 状态变化检测
dispose()
```

伪代码：

```js
async pickFlybar(flybar) {
  this.flybarMount.attach(flybar.root)
  await gsap.to(flybar.root.position, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'power2.out' })
  this.flybar = flybar
}

async dropFlybar(targetAnchor) {
  targetAnchor.attach(this.flybar.root)
  await gsap.to(this.flybar.root.position, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'power2.in' })
  this.flybar = null
}
```

### 2.4 状态机（由 FactoryController await 链推进）

```
idle ──assign(from,to)──▶ moving(toFrom)
                              │ moveToX 完成
                              ▼
                            picking ──pickFlybar 完成──▶ carrying
                                                            │ moveToX(toTo)
                                                            ▼
                                                          dropping
                                                  dropFlybar 完成
                                                            ▼
                                                          idle
```

每次 await 完成由 `FactoryController` 同步更新 `state.status` + `state.trackText`：`前行 / 取飞杆 / 后退 / 下飞杆 / 待机`。

### 2.5 CanvasTexture 节流

仅在 `labelText` / `trackText` 变化时重绘 + `texture.needsUpdate = true`，不每帧画。

---

## §3 `FactoryState` + `FactoryController`

### 3.1 数据模型

```js
{
  cranes: [
    { id, mode, status, x, labelText, trackText, carryingFlybarId, task }
  ],
  tanks:   [ { id, x, z, occupiedFlybarId } ],
  flybars: [ { id, location: { kind: 'tank'|'crane', tankId?|craneId? } } ]
}
```

其中 `task` 形状固定为：

```js
{ fromTankId, toTankId, flybarId }
```

`flybarId` 在派单时写入，后续释放 reservation 时必须使用该值，不能从 `fromTankId` 再反查，因为取杆后源槽会被置空。

订阅极简（mitt 已在依赖里）：

```js
import mitt from 'mitt'
export function createFactoryState(initial) {
  const emitter = mitt()
  return { ...initial, on: emitter.on, emit: emitter.emit }
}
```

事件只发**需要外部立即响应**的（如 `mode-changed`、`label-changed`）。本期位置/任务状态由 `FactoryController` 写入，文本由 `Crane.update(dt)` 节流刷新。

### 3.2 Controller 规则

`FactoryController.update(dt)` 内部累积 `acc`，**每 1000ms 触发一次 `tick()`**：

1. 遍历 `cranes`，仅对 `status === 'idle'` 的天车随机派单：
   - 选一个当前有飞杆且未被 reserved 的槽作为 `fromTankId`。
   - 读取该槽上的 `occupiedFlybarId`，写入 `flybarId`。
   - 在剩余空槽中随机选 `toTankId`。
   - 写入 `crane.task = { fromTankId, toTankId, flybarId }`，`status = 'moving'`，`trackText = '前行'`。
   - 将 `flybarId` 放入 `_reservedFlybars`，将 `toTankId` 放入 `_reservedTanks`。
2. `FactoryController` 按 `moveToX → pickFlybar → moveToX → dropFlybar` await 推进，最终回到 `idle`。
3. 每 ~15s 随机选一台天车切下一种模式（auto→manual→maintenance→auto）。
4. 取杆后同步：
   - `fromTank.occupiedFlybarId = null`
   - `crane.carryingFlybarId = flybarId`
   - `flybars[flybarId].location = { kind: 'crane', craneId }`
5. 放杆后同步：
   - `toTank.occupiedFlybarId = flybarId`
   - `crane.carryingFlybarId = null`
   - `flybars[flybarId].location = { kind: 'tank', tankId: toTankId }`
6. 任务结束或失败时用 `task.flybarId` / `task.toTankId` 释放 reservation。
7. 暴露 `pause() / resume()` 便于调试。

### 3.3 解耦后效益

- 渲染依然 60fps，controller 1Hz 派单，无性能浪费。
- 后续 WS / 短轮询：新增 `PollingAdapter` 写入同形状 `FactoryState`；如果后台直接下发任务，则保留 `FactoryController` 的动画编排，移除本地随机派单即可。

---

## §4 TSL 材质 + CanvasTexture

### 4.1 `createCraneMaterial(baseMap)`

```js
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { texture, uniform, color, vec3, mix } from 'three/tsl'

export function createCraneMaterial(baseMap) {
  const mat = new MeshStandardNodeMaterial()
  const modeColor    = uniform(color('#22c55e'))
  const tintStrength = uniform(0.5)

  const baseSampled = texture(baseMap)
  const tintMul     = mix(vec3(1, 1, 1), modeColor, tintStrength)
  mat.colorNode = baseSampled.rgb.mul(tintMul)

  mat.userData = { modeColor, tintStrength }
  return mat
}
```

- `tintStrength` 默认 0.5，原纹理细节仍可辨；偏重时下调到 0.3。
- 不含呼吸光/扫描线。
- `metalness/roughness` 沿用原 GLB 材质值（替换前读出，写到新材质对应字段；非 PBR 则用 0.5/0.6）。
- 每台 crane 独立材质实例（共享 `baseMap`），确保 `setMode` 互不影响。

`setMode(mode)`：
```js
const targetHex = { auto: '#22c55e', manual: '#eab308', maintenance: '#ef4444' }[mode]
gsap.to(this.material.userData.modeColor.value, { r, g, b, duration: 0.4 })
```

### 4.2 `createTankMaterial(baseMap)`

```js
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { texture, attribute } from 'three/tsl'

export function createTankMaterial(baseMap) {
  const mat = new MeshStandardNodeMaterial()
  mat.colorNode      = texture(baseMap)
  mat.roughnessNode  = attribute('aRough', 'float')
  mat.metalnessNode  = attribute('aMetal', 'float')
  return mat
}
```

`TankField` 构建时为每个实例填 `aRough / aMetal`：基础值 ± 0.2 随机，挂为 `InstancedBufferAttribute`。

槽布局由 `FACTORY_CONFIG.tanks` 生成：

```js
const TANK_WIDTH_X = 8.57
const TANK_SPACING_X = TANK_WIDTH_X * 1.2 // 10.284
const TANK_COUNT = 40
const originX = -((TANK_COUNT - 1) * TANK_SPACING_X) / 2
```

本期只有 1 行槽，`rowZ = [0]`。第 `i` 个槽坐标为：

```js
{
  id: i,
  x: originX + i * TANK_SPACING_X,
  z: 0,
  occupiedFlybarId
}
```

### 4.3 `createLabelPlane`

```js
createLabelPlane({
  width, height, canvasW = 256, canvasH = 256,
  draw,                 // (ctx, text) => void
}) → { mesh, setText(text) }
```

- 内部 `<canvas>` + `THREE.CanvasTexture`。
- `setText` 仅当 text 与上次不同才重绘 + `needsUpdate = true`。
- `mesh` 用 `MeshBasicMaterial({ map, transparent: true })`。
- 编号 / 轨迹 plane 共用工厂，`draw` 回调不同。

### 4.4 朝向（基于 staticBBox）

- `labelLeft`：x=`bbox.min.x`, y/z=center, `rotation.y = +π/2`
- `labelRight`：x=`bbox.max.x`, y/z=center, `rotation.y = -π/2`
- `trackPlane`：x/z=center, y=`bbox.max.y + 6`，固定朝 +Z

---

## §5 更新循环 / 错误处理 / 验证

### 5.1 构建时机

`Factory` 在 `eventBus.on('source ready')` 后构建：
1. 取 `craneModel` / `flybarModel` / `tankBoxModel` / `railwayModel` glb（`sources.js` 需新增后三者）。
2. 第一台 crane scene `clone(true)` + bbox 缓存到 `Crane.staticBBox`。
3. 按 `config.cranes` 创建 N 台 Crane。
4. 创建 `TankField` / `Rails` / `FlybarPool`。
5. 初始化 `FactoryState`：位置、初始 mode/label、所有 flybar 默认在某些 tank 中。
6. 启动 `FactoryController`。

任一步资源缺失或 GLB 内部结构不符合预期：`console.error` 后抛错，停止构建。不要添加 fallback mesh，也不要 warn 后静默早退。

### 5.2 主循环挂接

```js
// world.js
update(dt) { this.factory?.update(dt) }

// Factory.update(dt)
this.controller.update(dt)
for (const c of this.cranes) c.update(dt)
this.tankField.update?.(dt)
```

### 5.3 错误处理

| 风险点 | 应对 |
|---|---|
| GLB 缺失或加载失败 | 保留 `Resources` 层 `console.error`；`World` 缺必要资源时 `console.error` + throw |
| `box.glb` 无 mesh | `TankField` 构造期 throw |
| `pickFlybar` 已挂 flybar | warn 后替换挂载对象，保持本地调试可见 |
| gsap tween 中状态机被强制重置 | `Crane.dispose()` / 任务取消时 `tl?.kill()` |
| InstancedMesh attribute 长度不匹配 | 构造内 assert，构造期 throw |
| 任务 reservation 释放错误 | `task` 必须携带 `flybarId`，释放时不从源槽反查 |
| clone 资源重复 dispose | GLB geometry/material/texture 归 `Resources`；实体只释放自己创建的 label texture / 替换材质 |
| controller tick 期间外部异步改 state | 本地仿真单线程，本期不处理；接 WS 后再加版本号 |

### 5.4 手测清单

1. 3 台 crane，编号 A/B/C 在两侧 plane 显示。
2. 槽阵列为 1 行 40 个，且为 1 个 InstancedMesh，`mesh.count === 40`。
3. 相邻槽 roughness/metalness 肉眼可见差异。
4. `setMode('manual')` 颜色平滑过渡，贴图细节仍可辨。
5. 两条 `railway.glb` 分别位于 `(0,15,-26)` / `(0,15,26)`。
6. controller 启动后任务流转：天车只沿 X 轴移动 → 飞杆从槽上 `(tank.x,-8,tank.z)` 取到天车 `(crane.x,12,crane.z)` → 移动 → 放回目标槽；轨迹文本依次切换。
7. `FactoryController` reservation 不泄漏，`flybars[id].location` 随取放同步更新。
8. trackText 不变的帧无 `needsUpdate = true`。
9. `world.dispose()` 不重复释放 GLB 共享 geometry/material/texture，不报错。

### 5.5 不在本期范围

- 槽液位 / 告警 / 编号
- 飞杆/天车碰撞、避障、多机排队
- TSL 状态高亮（呼吸光）
- 后台数据接入
- 单元测试

均通过现有架构留有插入点。
