import * as THREE from 'three/webgpu'
import { color, float, materialClearcoat, materialColor, materialRoughness, materialSpecularIntensity, mix, normalLocal, positionLocal, smoothstep, step, texture, uniform, vec2, vec3 } from 'three/tsl'

const LETTERS = ['a', 'b', 'x', 'y']
const PIXEL_GLYPHS = {
  a: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  b: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  x: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
}
const EXHIBIT_FRAME = {
  right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0), normal: new THREE.Vector3(0, 0, 1),
}

export function getButtonFrame(buttons) {
  const centerOf = (mesh) => {
    mesh.updateWorldMatrix(true, false)
    mesh.geometry.computeBoundingBox()
    return mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)
  }
  const right = centerOf(buttons.a).sub(centerOf(buttons.y)).normalize()
  const up = centerOf(buttons.x).sub(centerOf(buttons.b))
  up.addScaledVector(right, -up.dot(right)).normalize()
  const normal = new THREE.Vector3().crossVectors(right, up).normalize()
  if (right.lengthSq() < 0.99 || up.lengthSq() < 0.99 || normal.lengthSq() < 0.99) {
    throw new Error('无法从 ABXY 布局建立按键印花坐标。')
  }
  return { right, up, normal }
}

export default class ButtonPrint {
  constructor(debug) {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建按键字母纹理')
    context.fillStyle = '#fff'
    // 5×7 点阵按整数像素绘制，不依赖系统字体；每个字形在自己的 256² 图集格子中居中。
    const pixel = 24
    LETTERS.forEach((letter, index) => {
      PIXEL_GLYPHS[letter].forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] === '1') context.fillRect(index * 256 + 68 + x * pixel, 44 + y * pixel, pixel, pixel)
        }
      })
    })
    this.texture = new THREE.CanvasTexture(canvas)
    this.texture.name = 'Controller_ABXY_Print_Atlas'
    this.texture.colorSpace = THREE.NoColorSpace
    this.texture.minFilter = THREE.LinearMipmapLinearFilter
    this.texture.magFilter = THREE.NearestFilter
    this.params = { size: 0.85, opacity: 1 }
    this.size = uniform(this.params.size)
    this.opacity = uniform(this.params.opacity)
    this.folder = debug.ui.addFolder({ title: 'Controller Button Print', expanded: false })
    this.folder.addBinding(this.params, 'size', { min: 0.45, max: 0.95, step: 0.01 })
      .on('change', ({ value }) => { this.size.value = value })
    this.folder.addBinding(this.params, 'opacity', { min: 0, max: 1, step: 0.01 })
      .on('change', ({ value }) => { this.opacity.value = value })
  }

  applyTo(material, { geometry, matrix, part, frame = EXHIBIT_FRAME }) {
    const index = LETTERS.indexOf(part)
    if (index < 0) return
    geometry.computeBoundingBox()
    const center = geometry.boundingBox.getCenter(new THREE.Vector3())
    // 投影方向作为协向量用 Mᵀ 换回 Mesh 局部坐标；逆矩阵的方向变换在非均匀缩放下会扭曲文字。
    const columns = [0, 1, 2].map(axis => new THREE.Vector3().setFromMatrixColumn(matrix, axis))
    const project = direction => new THREE.Vector3(...columns.map(column => column.dot(direction)))
    const right = project(frame.right)
    const up = project(frame.up)
    const depth = project(frame.normal)
    const min = new THREE.Vector3(Infinity, Infinity, Infinity)
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
    const point = new THREE.Vector3()
    const projected = new THREE.Vector3()
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).sub(center)
      projected.set(point.dot(right), point.dot(up), point.dot(depth))
      min.min(projected)
      max.max(projected)
    }
    const width = Math.min(max.x - min.x, max.y - min.y)
    const thickness = max.z - min.z
    if (width <= 0 || thickness <= 0) throw new Error(`${part} 无有效的印花表面`)
    const local = positionLocal.sub(center)
    const printUv = vec2(local.dot(right), local.dot(up)).div(float(width).mul(this.size)).add(0.5)
    const atlasUv = vec2(printUv.x.add(index).div(4), printUv.y)
    const alpha = texture(this.texture, atlasUv).a
    const inBounds = step(0, printUv.x).mul(step(printUv.x, 1)).mul(step(0, printUv.y)).mul(step(printUv.y, 1))
    const luminance = materialColor.rgb.dot(vec3(0.2126, 0.7152, 0.0722))
    const lightKeycap = smoothstep(0.32, 0.45, luminance)
    // 深度与几何法线双重限制：只印在朝外的键帽顶面，不把字母投到侧壁和底面。
    const top = smoothstep(max.z - thickness * 0.18, max.z - thickness * 0.02, local.dot(depth))
    const face = smoothstep(0.6, 0.95, normalLocal.dot(depth.clone().normalize()))
    // 缩小时 mipmap 会把细点阵平均成半透明灰，浅键帽的深字单独提高覆盖率，保留像素边缘的可读性。
    const inkAlpha = mix(alpha, smoothstep(0.05, 0.45, alpha), lightKeycap)
    const mask = inkAlpha.mul(inBounds).mul(top).mul(face).mul(this.opacity)
    const ink = mix(color('#f5f5f7'), color('#101014'), lightKeycap)
    material.colorNode = mix(materialColor.rgb, ink, mask)
    // 浅键帽的深色油墨单独采用哑光表面，避免清漆高光把字母冲成与奶白底色相近的灰。
    // 只在对应印花像素生效；深色键帽的浅字、键帽其余表面和已有颗粒节点保持原来的材质响应。
    const matteInk = mask.mul(lightKeycap)
    material.roughnessNode = mix(material.roughnessNode ?? materialRoughness, float(0.7), matteInk)
    material.clearcoatNode = (material.clearcoatNode ?? materialClearcoat).mul(float(1).sub(matteInk.mul(0.95)))
    material.specularIntensityNode = (material.specularIntensityNode ?? materialSpecularIntensity).mul(float(1).sub(matteInk.mul(0.75)))
  }

  destroy() {
    this.folder.dispose()
    this.texture.dispose()
  }
}
