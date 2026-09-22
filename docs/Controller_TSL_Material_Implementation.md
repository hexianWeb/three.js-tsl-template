# Controller Shell TSL 程序化塑料材质实现说明

## 当前实现与方案校正（2026-09-22）

本文原有第 1–21 节是视觉参考与概念草案，代码示例不能直接作为当前 Three.js 的可运行实现。实际实现以本节和源码为准。

- **范围**：`Controller_Shell` 使用磨砂塑料；用户确认外壳效果后，新增 ABXY / DPad 清漆塑料，详见下节。
- **模块**：`src/js/World/Product/ControllerShellMaterial.js` 管理材质、参数、面板和销毁；`src/shaders/controllerPlastic.js` 管理纯 TSL 函数；由 `ModelAdapter` 装配。
- **噪声 API**：Three.js 0.186 当前导出 `mx_noise_float`，不导出草案中的 `snoise`。当前使用两次 3D Perlin 噪声，微颗粒信号复用于 Roughness 和 Bump，避免三组各三层 FBM 的开销。
- **凹凸 API**：当前 `bumpMap()` 通过偏移 UV 重采样计算高度差，不能正确求纯 `positionLocal` 高度场的梯度。实现改为视空间表面梯度法线，不使用贴图、切线或额外 UV。
- **尺度**：以外壳最长边为统一参考长度，补偿加载时的节点缩放；不按 XYZ 各自归一化。频率表示每个参考长度的噪声格数 / 层纹周期数，不是 Blender Noise Scale，也不是毫米。纹理随模型移动，后续统一展示缩放不改变颗粒数量。
- **Bump 强度**：当前参数是坡度尺度，先除以频率再换算为视空间高度，不能照搬草案中 `0.03` 的高度值。
- **抗闪烁**：使用屏幕导数估计采样足迹，对无法分辨的高频噪声与层纹逐渐衰减。这是实用的带宽限制，不等于精确预积分，也不保证所有设备与极端近景均无混叠。
- **PBR**：默认 `MeshStandardNodeMaterial`、Metalness 0、Roughness 0.55，不启用 Clearcoat。标准介电反射足以作为无涂层塑料基线；需要精确 IOR / 涂层 LookDev 时再使用 Physical，而非默认堆叠清漆。
- **颜色**：默认 `#298de3`，线性空间小幅乘性变化（0.025），避免明显云斑；主质感来自粗糙度和微法线。
- **层纹**：默认关闭；提供 X / Y / Z 局部轴选择，Y 只是初始选项，不假定是 Blender 打印轴。
- **Lightmap**：继续使用现有 EXR、`uv1`、`channel = 1`、`flipY = true`、线性色彩空间。它是烘焙间接光，不是塑料颜色或法线贴图。更换材质不会重新烘焙光照。
- **生命周期**：原 GLB 材质被保留，销毁时恢复后交由 `ModelAdapter` 去重回收；新材质与本组件面板显式释放，不销毁共享 Lightmap。

### 当前调参及验收

在 `Controller Shell Plastic` 面板先调 Base color / roughness，再调 grainFrequency / bumpStrength，最后才考虑颜色变化与可选打印层纹。频率越高不代表越真实，超出屏幕分辨率的颗粒会被衰减；中远景主要由 PBR 粗糙度维持磨砂观感。

Phase 4 原有视觉流程和外壳材质效果已由用户确认。新增按键材质仍需在 WebGPU 浏览器检查近景高光、运动稳定性、Replay / Skip。当前没有新增 HDRI，光照仍以现有场景和 EXR 为准。

### 按键高亮清漆塑料

- `ControllerButtonMaterial.js` 绑定实际 GLB 的 `Button_A/B/X/Y` 和 `DPad`；`buttons` 是无 Mesh 的节点，不作为材质目标。名称解析仍集中在 `ModelAdapter`。
- 保留 GLB 奶油色底色与可用的颜色/透明度贴图引用，独立创建 `MeshPhysicalNodeMaterial`，不修改共享的原材质。
- 默认底层 Roughness `0.28`、IOR `1.47`、微凹凸坡度 `0.025`；不加入打印纹。
- 清漆强度 `0.85`、清漆 Roughness `0.12`；`clearcoatNormalNode` 使用平滑几何法线，底层微颗粒不扰乱表层高光。该模型的清漆 IOR 固定约 1.5，面板 IOR 调节的是底层塑料。
- 面板为 `Controller Button Plastic`：降低 `clearcoatRoughness` 会让高光更锐利，提高 `clearcoat` 会增强涂层贡献；高光位置与亮度仍取决于灯光和观察角度。
- 复用外壳的滤波噪声与表面梯度函数，按键以各自最长边归一化；不使用外壳专属 Lightmap。
- 销毁时恢复原材质并释放新材质与面板，原共享材质/纹理由 `ModelAdapter` 统一去重回收。

## 1. 目标

为 iPhone Duo → NDS 项目的 Controller 外壳实现一套可在 Three.js WebGPU / TSL 中运行的程序化塑料材质。

目标观感：

- 真实磨砂塑料
- 轻微注塑颗粒感
- 可选轻微 3D 打印层纹
- 不依赖外部 BaseColor / Normal / Roughness 贴图
- 尽量不依赖 UV
- 适合近距离 Hero Shot
- 可通过参数快速调整

该材质主要用于：

```text
Controller_Shell
```

DPad 与 ABXY 建议继续使用更平滑、更简单的塑料材质，不需要明显的 3D 打印层纹。

---

# 2. Blender 参考材质逻辑

当前 Blender 材质的核心结构可概括为：

```text
Noise Texture 3D
Scale ≈ 1500
Detail ≈ 2
↓
ColorRamp
↓
Base Color


Noise Texture 3D
Scale ≈ 2000
Detail ≈ 2
↓
ColorRamp
↓
Bump
Strength ≈ 0.1
↓
Normal


Principled BSDF

Metallic = 0
Roughness = 0.55
IOR = 1.5
```

TSL 版本不要求数值 1:1 对应 Blender。

重点是复刻逻辑，而不是机械复制参数。

---

# 3. TSL 实现结构

推荐将材质拆成三部分：

```text
Color Noise
↓
Base Color Variation

Roughness Noise
↓
Roughness Variation

Micro Noise / Print Layer
↓
Bump / Normal
```

最终：

```text
positionLocal
│
├─ FBM Noise A
│  └─ Base Color
│
├─ FBM Noise B
│  └─ Roughness
│
└─ FBM Noise C
   └─ Bump / Normal
```

---

# 4. 为什么使用 positionLocal

不建议使用 UV 作为程序化 Noise 输入。

推荐：

```js
positionLocal
```

原因：

- 更接近 Blender 的 3D Noise Texture
- 不依赖 UV
- 圆角和曲面不会产生明显 UV Seam
- 修改 UV 不会影响塑料微表面
- 很适合 Controller 这类 Hard Surface 产品模型

基础形式：

```js
snoise(
  positionLocal.mul(scale)
)
```

---

# 5. Material 类型

推荐：

```js
THREE.MeshPhysicalNodeMaterial
```

原因：

- 支持 PBR
- 支持 Roughness
- 支持 IOR
- 支持 Clearcoat
- 后续方便继续增加更复杂的 TSL Node

如果后续不需要 Clearcoat，也可以使用：

```js
THREE.MeshStandardNodeMaterial
```

---

# 6. 推荐 Imports

以当前 Three.js WebGPU + TSL 架构为目标：

```js
import * as THREE from 'three/webgpu'

import {
  Fn,
  float,
  color,
  mix,
  smoothstep,
  positionLocal,
  snoise,
  bumpMap,
  uniform
} from 'three/tsl'
```

如果使用的 Three.js 版本 API 有变化，以当前版本官方 TSL API 为准。

---

# 7. FBM 3D Noise

Blender 的：

```text
Noise Texture
Detail ≈ 2
```

可以用多层 Simplex Noise 叠加模拟。

示例：

```js
const fbm3D = Fn(([p]) => {

  const n1 = snoise(
    p
  ).mul(0.50)

  const n2 = snoise(
    p.mul(2.0)
  ).mul(0.25)

  const n3 = snoise(
    p.mul(4.0)
  ).mul(0.125)

  return n1
    .add(n2)
    .add(n3)
    .mul(0.5)
    .add(0.5)

})
```

目标输出范围近似：

```text
0 → 1
```

不需要完全复制 Blender Noise Texture。

---

# 8. Base Color

## 推荐原则

真实塑料的颜色变化应该非常轻。

不要做：

```text
深蓝
→
亮蓝
```

这种过强变化。

更合理：

```text
Blue A
≈
Blue B
```

例如：

```js
const blueA = color('#2688E0')
const blueB = color('#2B91E7')
```

生成 Color Noise：

```js
const colorNoiseScale = uniform(200.0)

const baseNoise = fbm3D(
  positionLocal.mul(
    colorNoiseScale
  )
)
```

ColorRamp 可近似为：

```js
const colorMask = smoothstep(
  float(0.30),
  float(0.70),
  baseNoise
)
```

最终：

```js
const baseColor = mix(
  blueA,
  blueB,
  colorMask
)
```

应用：

```js
material.colorNode = baseColor
```

---

# 9. Roughness

不要让整个 Controller 固定为：

```text
Roughness = 0.55
```

建议加入轻微 Roughness Variation。

示例：

```js
const roughnessNoiseScale =
  uniform(350.0)

const roughNoise =
  fbm3D(
    positionLocal.mul(
      roughnessNoiseScale
    )
  )
```

推荐范围：

```text
0.51 ～ 0.59
```

例如：

```js
const roughnessNode =
  roughNoise
    .mul(0.08)
    .add(0.51)
```

然后：

```js
material.roughnessNode =
  roughnessNode
```

这样在 HDRI / Area Light 下会出现更加自然的微高光变化。

---

# 10. Micro Bump

高频 Noise 用于塑料微表面。

示例：

```js
const bumpNoiseScale =
  uniform(900.0)

const bumpNoise =
  fbm3D(
    positionLocal.mul(
      bumpNoiseScale
    )
  )
```

增强局部对比：

```js
const bumpHeight =
  smoothstep(
    float(0.35),
    float(0.65),
    bumpNoise
  )
```

然后：

```js
const bumpStrength =
  uniform(0.03)

const microNormal =
  bumpMap(
    bumpHeight,
    bumpStrength
  )
```

应用：

```js
material.normalNode =
  microNormal
```

---

# 11. 3D 打印层纹

如果需要保留“高质量 3D 打印原型感”，可以增加一层非常弱的周期纹理。

核心逻辑：

```text
positionLocal.y
↓
frequency
↓
sin
↓
Layer Height
↓
与 Micro Noise 混合
```

概念代码：

```js
const layerFrequency =
  uniform(160.0)

const layerStrength =
  uniform(0.02)

const printLayer =
  positionLocal.y
    .mul(layerFrequency)
    .sin()
    .mul(layerStrength)
```

然后与 Bump Height 叠加：

```js
const finalHeight =
  bumpHeight
    .add(printLayer)
```

最终：

```js
material.normalNode =
  bumpMap(
    finalHeight,
    bumpStrength
  )
```

注意：

> 3D Print Layer 只能作为轻微细节。

正常距离不应该非常明显。

---

# 12. 推荐 Material 参数

基础材质：

```js
const material =
  new THREE.MeshPhysicalNodeMaterial()
```

推荐：

```js
material.colorNode =
  baseColor

material.metalnessNode =
  float(0.0)

material.roughnessNode =
  roughnessNode

material.iorNode =
  float(1.47)

material.normalNode =
  microNormal
```

如果需要轻微 Clearcoat：

```js
material.clearcoatNode =
  float(0.06)

material.clearcoatRoughnessNode =
  float(0.30)
```

Controller Shell 不应该出现明显镜面 Clearcoat。

---

# 13. 推荐初始参数

以下参数作为 Three.js 调试起点：

```text
Base Color A
#2688E0

Base Color B
#2B91E7

Metalness
0.0

Base Roughness
≈ 0.55

IOR
1.47

Color Noise Scale
150 ～ 300

Roughness Noise Scale
250 ～ 500

Micro Bump Scale
600 ～ 1500

Bump Strength
0.015 ～ 0.05

3D Print Frequency
根据模型尺寸调整

3D Print Strength
0.005 ～ 0.03

Clearcoat
0.03 ～ 0.08

Clearcoat Roughness
0.25 ～ 0.40
```

---

# 14. Blender Scale 不要直接复制

Blender：

```text
Noise Scale = 1500 / 2000
```

不能直接认为 Three.js 应该写：

```js
positionLocal.mul(1500)
```

最终视觉与以下因素有关：

- GLB 实际尺寸
- Blender 单位
- Apply Transform 状态
- Three.js 模型世界尺寸

因此所有 Scale 推荐写成：

```js
uniform()
```

方便实时调试。

例如：

```js
const colorNoiseScale =
  uniform(200)

const roughnessNoiseScale =
  uniform(350)

const bumpNoiseScale =
  uniform(900)
```

---

# 15. 推荐调参顺序

不要同时调整所有参数。

推荐：

```text
① Base Color
↓
② Lighting / HDRI
↓
③ Roughness
↓
④ Micro Bump
↓
⑤ Roughness Variation
↓
⑥ Color Variation
↓
⑦ 3D Print Layer
↓
⑧ Clearcoat
```

真实感优先级：

```text
Geometry Bevel
>
Lighting
>
Roughness
>
Micro Normal
>
Roughness Variation
>
Color Noise
>
Print Layer
```

---

# 16. 推荐材质层级

## Controller Shell

目标：

```text
磨砂
细颗粒
略带原型打印感
```

推荐：

```text
Roughness
0.50 ～ 0.60

Micro Bump
明显但非常细

Print Layer
非常弱
```

---

## DPad

不建议使用明显打印纹。

推荐：

```text
Metalness
0

Roughness
0.30 ～ 0.36

IOR
≈ 1.47

Micro Bump
非常弱或关闭
```

目标：

```text
更平滑
更像独立塑料按键
```

---

## ABXY Buttons

比 DPad 再稍微光滑：

```text
Metalness
0

Roughness
0.25 ～ 0.32

IOR
≈ 1.47
```

不需要明显 Noise / Print Layer。

---

# 17. 推荐代码结构

最终建议封装为：

```js
createControllerShellMaterial({
  colorA,
  colorB,
  colorNoiseScale,
  roughnessMin,
  roughnessMax,
  roughnessNoiseScale,
  bumpScale,
  bumpStrength,
  enablePrintLayer,
  printFrequency,
  printStrength,
  clearcoat,
  clearcoatRoughness
})
```

返回：

```js
MeshPhysicalNodeMaterial
```

避免把所有 TSL Node 逻辑散落在场景初始化代码中。

---

# 18. 推荐目录

```text
src/

materials/
├─ controllerShellMaterial.js
├─ dpadMaterial.js
└─ buttonMaterial.js

config/
└─ materialConfig.js
```

材质参数独立放置：

```js
export const controllerShellConfig = {

  colorA: '#2688E0',
  colorB: '#2B91E7',

  colorNoiseScale: 200,

  roughnessMin: 0.51,
  roughnessMax: 0.59,

  roughnessNoiseScale: 350,

  bumpNoiseScale: 900,
  bumpStrength: 0.03,

  printLayer: true,
  printFrequency: 160,
  printStrength: 0.015,

  ior: 1.47,

  clearcoat: 0.06,
  clearcoatRoughness: 0.30

}
```

---

# 19. 调试 UI

开发阶段建议接入 Tweakpane。

需要实时控制：

```text
Color Noise Scale

Roughness Min
Roughness Max

Roughness Noise Scale

Bump Noise Scale
Bump Strength

Print Layer ON / OFF

Print Frequency
Print Strength

Clearcoat
Clearcoat Roughness
```

完成 LookDev 后再锁定参数。

---

# 20. 验收标准

Controller Shell 完成后应满足：

### 中距离

- 看起来是正常蓝色塑料
- 不应看到明显 Noise 图案
- 高光柔和
- 不显得像纯色 CG 材质

### 近距离

- 可以看到细微塑料颗粒
- Roughness 有轻微自然变化
- 表面有可信的微结构
- 可选看到非常弱的打印层纹

### 极近距离

允许看出程序化纹理，但：

- 不能像砂纸
- 不能像石材
- 不能像橡胶
- 不能出现明显重复贴图感

---

# 21. 最终目标

最终材质视觉应接近：

```text
真实消费电子塑料
        +
高质量 Prototype
        +
极轻微 3D Printing Feel
```

而不是：

```text
纯色塑料
```

也不是：

```text
明显廉价 FDM 打印件
```

重点是通过：

```text
PBR
+
Procedural Roughness
+
Micro Normal
+
Very Subtle Color Variation
+
Optional Print Layers
```

让 Controller 在 Three.js Hero Shot 和近距离产品展示中具备可信的真实材质感。
