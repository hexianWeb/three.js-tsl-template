# Controller Shell TSL 程序化塑料材质实现说明

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
