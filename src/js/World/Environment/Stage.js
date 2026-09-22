import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import Experience from '../../Experience.js'

// 程序化桌板是占位方案，用于在外部展台模型到位前验收接触阴影与构图。
// Stage 独立挂在 Scene 下，不进入产品 fitModel() 的包围盒，也不挂在折叠 Pivot 或 Controller 装配节点下。
export default class Stage {
  constructor({ surfaceY }) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug
    this.surfaceY = surfaceY

    this.params = {
      visible: true,
      width: 20,
      depth: 20,
      thickness: 0.12,
      bevel: 0.02,
      surfaceOffset: 0,
      color: '#a79f92',
      roughness: 0.72,
    }

    this.material = new THREE.MeshStandardNodeMaterial({
      color: new THREE.Color(this.params.color),
      roughness: this.params.roughness,
      metalness: 0,
      name: 'Stage_Matte_Board',
    })
    this.mesh = new THREE.Mesh(this.createGeometry(), this.material)
    this.mesh.name = 'StageBoard'
    this.mesh.castShadow = false
    this.mesh.receiveShadow = true
    this.mesh.visible = this.params.visible
    this.applyTransform()
    this.scene.add(this.mesh)
    this.debugInit()
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
    this.folder.addBinding(this.params, 'color', { label: 'Color' })
      .on('change', ({ value }) => this.material.color.set(value))
    this.folder.addBinding(this.params, 'roughness', {
      label: 'Roughness',
      min: 0.2,
      max: 1,
      step: 0.01,
    }).on('change', ({ value }) => { this.material.roughness = value })

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
  }
}
