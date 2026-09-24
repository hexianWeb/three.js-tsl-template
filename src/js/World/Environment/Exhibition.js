import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import * as THREE from 'three/webgpu'
import Experience from '../../Experience.js'
import ProductPlinth from './ProductPlinth.js'

export default class Exhibition {
  constructor({ metrics, stage }) {
    const experience = new Experience()
    this.scene = experience.scene
    this.debug = experience.debug
    this.sizes = experience.sizes
    this.metrics = metrics
    this.stage = stage
    this.params = {
      enabled: true,
      showParts: true,
      showDock: true,
      compact: false,
      hideOnNarrow: true,
      narrowAspect: 1.35,
      widthRatio: 1.5,
      depthRatio: 1.61,
      heightRatio: 0.06,
      cornerRatio: 0.05,
      bevelRatio: 0.002,
      offsetX: 0,
      offsetZ: 0.02,
      color: '#e8e3da',
      roughness: 0.42,
      edgeGlow: 1.7,
      partsX: -1.26,
      partsZ: -1.15,
      partsYaw: 45,
      partsScale: 1.3,
      dockX: 1.1,
      dockZ: -1.35,
      dockYaw: -40,
      dockScale: 1.37,
    }
    this.group = new THREE.Group()
    this.group.name = 'Exhibition'
    this.plinth = new ProductPlinth()
    this.group.add(this.plinth.group)
    this.setGrayboxes()
    this.scene.add(this.group)
    this.applyLayout()
    this.debugInit()
  }

  setGrayboxes() {
    this.grayGeometry = new RoundedBoxGeometry(1, 1, 1, 3, 0.06)
    this.grayMaterials = [
      new THREE.MeshStandardNodeMaterial({ color: '#d6d3cd', roughness: 0.62 }),
      new THREE.MeshStandardNodeMaterial({ color: '#a3adb1', roughness: 0.56 }),
      new THREE.MeshStandardNodeMaterial({ color: '#b9b6ae', roughness: 0.6 }),
    ]
    this.parts = new THREE.Group()
    this.parts.name = 'PartsDisplay_Graybox'
    this.dock = new THREE.Group()
    this.dock.name = 'ColorDock_Graybox'
    const block = (parent, name, dimensions, position, material = 0) => {
      const mesh = new THREE.Mesh(this.grayGeometry, this.grayMaterials[material])
      mesh.name = name
      mesh.scale.set(...dimensions)
      mesh.position.set(...position)
      mesh.castShadow = true
      mesh.receiveShadow = true
      parent.add(mesh)
    }
    // 灰盒只描述展品的体量和支撑关系，不伪装成实际上下壳或滑轨资产。
    block(this.parts, 'PartsBase', [0.72, 0.07, 0.26], [0, 0.035, 0])
    block(this.parts, 'PartsBoard', [0.65, 0.66, 0.025], [0, 0.4, -0.025])
    block(this.parts, 'ShellPlaceholder', [0.35, 0.29, 0.055], [-0.09, 0.44, 0.022], 1)
    block(this.parts, 'DpadPlaceholder', [0.10, 0.10, 0.035], [0.2, 0.53, 0.025], 2)
    block(this.parts, 'ButtonsPlaceholder', [0.12, 0.12, 0.035], [0.2, 0.32, 0.025], 2)
    block(this.dock, 'DockBase', [0.68, 0.11, 0.33], [0, 0.055, 0])
    for (let i = 0; i < 3; i++) {
      block(this.dock, `SamplePlaceholder_${i + 1}`, [0.18, 0.27, 0.075], [(i - 1) * 0.205, 0.245, 0], i)
    }
    this.group.add(this.parts, this.dock)
  }

  applyLayout() {
    const { width: w, depth: d, center, supportY } = this.metrics
    const p = this.params
    const height = w * p.heightRatio
    const width = w * p.widthRatio
    const depth = d * p.depthRatio
    const centerX = center.x + p.offsetX * w
    const centerZ = center.z + p.offsetZ * d
    this.plinth.setLayout({
      width,
      depth,
      height,
      centerX,
      centerZ,
      supportY,
      radius: w * p.cornerRatio,
      bevel: w * p.bevelRatio,
    })
    this.plinth.setAppearance(p)
    const floorY = p.enabled ? supportY - height : supportY
    this.stage.setExhibitionLayout({ floorY, centerX, centerZ, width, depth, enabled: p.enabled })
    this.parts.position.set(center.x + p.partsX * w, floorY, center.z + p.partsZ * d)
    this.parts.rotation.y = THREE.MathUtils.degToRad(p.partsYaw)
    this.parts.scale.setScalar(w * p.partsScale)
    this.dock.position.set(center.x + p.dockX * w, floorY, center.z + p.dockZ * d)
    this.dock.rotation.y = THREE.MathUtils.degToRad(p.dockYaw)
    this.dock.scale.setScalar(w * p.dockScale)
    this.resize()
  }

  resize() {
    const p = this.params
    p.compact = this.sizes.width / this.sizes.height < p.narrowAspect
    const showSides = !p.hideOnNarrow || !p.compact
    this.group.visible = p.enabled
    this.parts.visible = p.showParts && showSides
    this.dock.visible = p.showDock && showSides
    this.compactBinding?.refresh()
  }

  debugInit() {
    this.folder = this.debug.ui.addFolder({ title: 'Exhibition / S1', expanded: false })
    this.folder.addBinding(this.params, 'enabled', { label: 'Enabled' }).on('change', () => this.applyLayout())
    for (const key of ['showParts', 'showDock', 'hideOnNarrow']) {
      this.folder.addBinding(this.params, key).on('change', () => this.resize())
    }
    this.compactBinding = this.folder.addBinding(this.params, 'compact', { readonly: true, label: 'Narrow viewport' })
    this.folder.addBinding(this.params, 'narrowAspect', { min: 1, max: 1.6, step: 0.05 }).on('change', () => this.resize())
    const plinth = this.folder.addFolder({ title: 'Plinth / product units' })
    const ranges = {
      widthRatio: [1.1, 2, 0.01],
      depthRatio: [1.05, 1.9, 0.01],
      heightRatio: [0.025, 0.12, 0.001],
      cornerRatio: [0.05, 0.24, 0.005],
      bevelRatio: [0.002, 0.025, 0.001],
      offsetX: [-0.3, 0.3, 0.01],
      offsetZ: [-0.3, 0.3, 0.01],
    }
    for (const [key, [min, max, step]] of Object.entries(ranges)) {
      plinth.addBinding(this.params, key, { min, max, step }).on('change', () => this.applyLayout())
    }
    plinth.addBinding(this.params, 'color').on('change', () => this.plinth.setAppearance(this.params))
    for (const [key, min, max] of [['roughness', 0.2, 0.8], ['edgeGlow', 0, 3]]) {
      plinth.addBinding(this.params, key, { min, max, step: 0.01 }).on('change', () => this.plinth.setAppearance(this.params))
    }
    const sides = this.folder.addFolder({ title: 'Display grayboxes' })
    for (const prefix of ['parts', 'dock']) {
      for (const [suffix, min, max, step] of [['X', -3, 3, 0.01], ['Z', -2, 2, 0.01], ['Yaw', -90, 90, 1], ['Scale', 0.5, 1.5, 0.01]]) {
        sides.addBinding(this.params, `${prefix}${suffix}`, { min, max, step }).on('change', () => this.applyLayout())
      }
    }
  }

  destroy() {
    this.folder.dispose()
    this.plinth.destroy()
    this.grayGeometry.dispose()
    this.grayMaterials.forEach(material => material.dispose())
    this.group.removeFromParent()
  }
}
