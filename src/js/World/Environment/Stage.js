import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import Experience from '../../Experience.js'

// 程序化桌板是占位方案，用于在外部展台模型到位前验收接触阴影与构图。
// Stage 独立挂在 Scene 下，不进入产品 fitModel() 的包围盒，也不挂在折叠 Pivot 或 Controller 装配节点下。
// 台面贴图是 Poly Haven Plastic010 的 1K JPG。RoundedBox 每个面的 UV 都是 0–1，
// 与面的实际尺寸无关，所以平铺次数用宽深除以 tileSize，避免把桌板拉大时木纹一起被拉伸。
export default class Stage {
  constructor({ surfaceY, textures }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug
    this.surfaceY = surfaceY
    this.textures = this.configureTextures(textures)

    this.params = {
      visible: true,
      width: 20,
      depth: 20,
      thickness: 0.12,
      bevel: 0.02,
      surfaceOffset: 0,
      tint: '#ffffff',
      roughness: 1,
      normalScale: 1,
      tileSize: 2,
    }

    this.material = new THREE.MeshStandardNodeMaterial({
      color: new THREE.Color(this.params.tint),
      map: this.textures.color,
      normalMap: this.textures.normal,
      roughnessMap: this.textures.roughness,
      roughness: this.params.roughness,
      metalness: 0,
      name: 'Stage_Plastic',
    })
    this.material.normalScale.set(this.params.normalScale, this.params.normalScale)
    this.applyRepeat()
    this.mesh = new THREE.Mesh(this.createGeometry(), this.material)
    this.mesh.name = 'StageBoard'
    this.mesh.castShadow = false
    this.mesh.receiveShadow = true
    this.mesh.visible = this.params.visible
    this.applyTransform()
    this.scene.add(this.mesh)
    this.debugInit()
  }

  configureTextures(textures) {
    for (const key of ['color', 'normal', 'roughness']) {
      if (!textures?.[key]?.isTexture) {
        throw new Error(`Stage 缺少木质贴图：${key}`)
      }
    }

    textures.color.colorSpace = THREE.SRGBColorSpace
    // JPG 没有非颜色标记。法线与粗糙度必须按字节读取；走 sRGB 会把法线中性值推离 0.5，并把粗糙度中灰压暗。
    textures.normal.colorSpace = THREE.NoColorSpace
    textures.roughness.colorSpace = THREE.NoColorSpace

    for (const texture of Object.values(textures)) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      // 台面在主镜头里是大面积掠射，1K 平铺不加各向异性会沿视线糊成一条。
      texture.anisotropy = 8
    }

    return textures
  }

  applyRepeat() {
    const { width, depth, tileSize } = this.params
    const repeatX = width / tileSize
    const repeatY = depth / tileSize
    for (const texture of Object.values(this.textures)) {
      texture.repeat.set(repeatX, repeatY)
    }
  }

  createGeometry() {
    const { width, depth, thickness, bevel } = this.params
    // 倒角半径超过最薄边的一半会让 RoundedBoxGeometry 自交，这里按厚度夹取。
    const radius = Math.max(0, Math.min(bevel, thickness / 2 - 1e-4))
    return new RoundedBoxGeometry(width, thickness, depth, 3, radius)
  }

  rebuildGeometry() {
    this.mesh.geometry.dispose()
    this.mesh.geometry = this.createGeometry()
    this.applyRepeat()
    this.applyTransform()
  }

  applyTransform() {
    // surfaceY 是桌面上表面的世界高度；Box 以几何中心为原点，因此厚度向下延伸。
    this.mesh.position.y = this.surfaceY + this.params.surfaceOffset - this.params.thickness / 2
  }

  debugInit() {
    this.folder = this.debug.ui.addFolder({ title: 'Stage', expanded: false })

    this.folder.addBinding(this.params, 'visible', { label: 'Visible' })
      .on('change', ({ value }) => { this.mesh.visible = value })
    this.folder.addBinding(this.params, 'tint', { label: 'Tint' })
      .on('change', ({ value }) => this.material.color.set(value))
    this.folder.addBinding(this.params, 'roughness', {
      label: 'Roughness scale',
      min: 0,
      max: 2,
      step: 0.01,
    }).on('change', ({ value }) => { this.material.roughness = value })
    this.folder.addBinding(this.params, 'normalScale', {
      label: 'Normal scale',
      min: 0,
      max: 2,
      step: 0.01,
    }).on('change', ({ value }) => this.material.normalScale.set(value, value))
    this.folder.addBinding(this.params, 'tileSize', {
      label: 'Tile size',
      min: 0.25,
      max: 10,
      step: 0.05,
    }).on('change', () => this.applyRepeat())

    const shape = this.folder.addFolder({ title: 'Shape' })
    const ranges = {
      width: [1, 20, 0.1],
      depth: [1, 20, 0.1],
      thickness: [0.02, 1, 0.01],
      bevel: [0, 0.2, 0.002],
    }
    Object.entries(ranges).forEach(([key, [min, max, step]]) => {
      shape.addBinding(this.params, key, { min, max, step })
        .on('change', () => this.rebuildGeometry())
    })
    shape.addBinding(this.params, 'surfaceOffset', {
      label: 'Surface offset',
      min: -0.5,
      max: 0.5,
      step: 0.005,
    }).on('change', () => this.applyTransform())
  }

  destroy() {
    this.folder.dispose()
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.material.dispose()
    Object.values(this.textures).forEach(texture => texture.dispose())
  }
}
