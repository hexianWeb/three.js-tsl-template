import * as THREE from 'three/webgpu'
import ExhibitLabel from './ExhibitLabel.js'
import { createPlinthGeometry } from './exhibitionGeometry.js'

// 道具以产品宽 W 为局部单位，挂在展区而非产品 Rig；标签不参与屏幕命中或模拟器更新。
export default class ExhibitProps {
  constructor({ debug, onLayout }) {
    this.onLayout = onLayout
    this.params = {
      showPlaque: true, showCard: true,
      plaqueX: -0.96, plaqueZ: 0.66, plaqueYaw: 8,
      cardX: 0.94, cardZ: 0.64, cardYaw: -18,
    }
    this.group = new THREE.Group()
    this.group.name = 'ExhibitProps'
    this.geometries = new Set()
    this.materials = new Set()
    this.plaque = this.createPlaque()
    this.card = this.createCard()
    this.group.add(this.plaque, this.card)
    this.debugInit(debug)
  }

  material(color, roughness = 0.6, metalness = 0) {
    const material = new THREE.MeshStandardNodeMaterial({ color, roughness, metalness })
    this.materials.add(material)
    return material
  }

  mesh(parent, name, geometry, material, position = [0, 0, 0]) {
    this.geometries.add(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(...position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  createPlaque() {
    const group = new THREE.Group()
    group.name = 'ProductPlaque'
    const shell = this.material('#c8c8c1', 0.48)
    // 60° 指铭牌面与水平地面的夹角；保持面板长度，用正弦/余弦同步推导支架，避免板面悬空。
    const inclination = THREE.MathUtils.degToRad(60)
    const faceHeight = 0.145
    const depth = faceHeight * Math.cos(inclination)
    const height = faceHeight * Math.sin(inclination)
    const shape = new THREE.Shape()
    shape.moveTo(-depth / 2, 0)
    shape.lineTo(depth / 2, 0)
    shape.lineTo(depth / 2, height)
    shape.closePath()
    const support = new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: false, steps: 1 })
    support.translate(0, 0, -0.13)
    support.rotateY(Math.PI / 2)
    this.mesh(group, 'PlaqueSupport', support, shell)
    const face = new THREE.Group()
    face.rotation.x = inclination - Math.PI / 2
    face.position.y = height / 2 + 0.004
    group.add(face)
    const plate = createPlinthGeometry(0.29, Math.hypot(depth, height), 0.007, 0.008, 0.001)
    plate.rotateX(Math.PI / 2)
    this.mesh(face, 'PlaquePlate', plate, shell)
    this.plaqueLabel = new ExhibitLabel({ width: 0.268, height: 0.122, name: 'ProductPlaqueLabel' })
    // 沿面板法线留出 0.002W 实体间距，避免斜视角下标签与底板争用深度。
    this.plaqueLabel.mesh.position.z = 0.0035 + 0.002
    face.add(this.plaqueLabel.mesh)
    this.plaqueLabel.redraw('#edeae3', ctx => {
      ctx.fillStyle = '#476177'
      ctx.fillRect(48, 48, 70, 8)
      ctx.font = '700 40px sans-serif'
      ctx.fillText('DUO / PRODUCT STUDY', 145, 63)
      ctx.fillStyle = '#18232d'
      ctx.font = '800 132px sans-serif'
      ctx.fillText('iPhone Duo', 45, 222)
      ctx.font = '700 58px sans-serif'
      ctx.fillText('3D Printed Controller', 48, 302)
      ctx.fillStyle = '#354652'
      ctx.font = '700 46px sans-serif'
      ctx.fillText('GAME CHANGER', 48, 389)
    })
    // 旋转后的薄板可能低于支架底面，以真实几何最低点接地，避免调角度时悬浮。
    this.ground(group)
    return group
  }

  createCard() {
    const group = new THREE.Group()
    group.name = 'OriginalGameCard'
    const shell = this.material('#303c48', 0.52)
    const edge = this.material('#1e2831', 0.72)
    const contact = this.material('#b99a58', 0.36, 0.35)
    this.mesh(group, 'CardLowerShell', createPlinthGeometry(0.2, 0.218, 0.01, 0.012, 0.0015), edge, [0, 0.005, 0])
    this.mesh(group, 'CardUpperShell', createPlinthGeometry(0.198, 0.214, 0.016, 0.011, 0.002), shell, [0, 0.018, -0.001])
    // 顶部凹槽与触点使用浅实心几何；无透明叠层，避免 GTAO 预通道和排序不一致。
    this.mesh(group, 'CardContactRecess', createPlinthGeometry(0.155, 0.028, 0.001, 0.002, 0.0002), edge, [0, 0.0266, 0.083])
    for (let i = 0; i < 8; i++) {
      this.mesh(group, `CardContact${i + 1}`, new THREE.BoxGeometry(0.01, 0.0007, 0.02), contact, [(i - 3.5) * 0.018, 0.0275, 0.083])
    }
    this.cardLabel = new ExhibitLabel({ width: 0.165, height: 0.156, name: 'OriginalGameCardLabel' })
    this.cardLabel.mesh.rotation.x = -Math.PI / 2
    // 壳体顶面 Y=0.026，标签沿朝上的法线偏移 0.002W，与铭牌使用相同间距。
    this.cardLabel.mesh.position.set(0, 0.026 + 0.002, -0.017)
    group.add(this.cardLabel.mesh)
    this.cardLabel.redraw('#e5e5d9', (ctx, h) => {
      ctx.fillStyle = '#355b73'
      ctx.fillRect(0, 0, 1000, 640)
      ctx.fillStyle = '#a7c1c9'
      // 原创双屏线稿呼应主机，不使用 ROM 画面或外部游戏美术。
      for (const y of [110, 298]) {
        ctx.beginPath()
        ctx.roundRect(580, y, 310, 156, 26)
        ctx.fill()
      }
      ctx.fillStyle = '#f3efe2'
      ctx.font = '600 145px sans-serif'
      ctx.fillText('DUO', 65, 217)
      ctx.font = '400 205px sans-serif'
      ctx.fillText('01', 60, 467)
      ctx.font = '500 34px sans-serif'
      ctx.fillText('TWO SCREENS. ONE WORLD.', 66, 577)
      ctx.fillStyle = '#283e4b'
      ctx.font = '600 73px sans-serif'
      ctx.fillText('GAME CARD', 65, 770)
      ctx.font = '400 31px sans-serif'
      ctx.fillText('DUO / ORIGINAL SERIES', 68, h - 59)
    })
    return group
  }

  ground(group) {
    const bounds = new THREE.Box3().setFromObject(group, true)
    for (const child of group.children) child.position.y -= bounds.min.y
  }

  setLayout({ width, depth, centerX, centerZ, floorY }) {
    this.layout = { width, depth, centerX, centerZ, floorY }
    this.applyLayout()
  }

  applyLayout() {
    if (!this.layout) return
    const { width: w, depth: d, centerX, centerZ, floorY } = this.layout
    for (const [prefix, group] of [['plaque', this.plaque], ['card', this.card]]) {
      group.scale.setScalar(w)
      group.position.set(centerX + this.params[`${prefix}X`] * w, floorY, centerZ + this.params[`${prefix}Z`] * d)
      group.rotation.y = THREE.MathUtils.degToRad(this.params[`${prefix}Yaw`])
    }
    this.onLayout?.()
  }

  setCompact(compact) {
    this.plaque.visible = this.params.showPlaque
    this.card.visible = this.params.showCard && !compact
    this.compact = compact
  }

  debugInit(debug) {
    this.folder = debug.ui.addFolder({ title: 'Exhibit Props / S3', expanded: false })
    for (const key of ['showPlaque', 'showCard']) {
      this.folder.addBinding(this.params, key).on('change', () => this.setCompact(this.compact))
    }
    for (const prefix of ['plaque', 'card']) {
      const folder = this.folder.addFolder({ title: prefix === 'plaque' ? 'Product plaque' : 'Original game card' })
      for (const [suffix, min, max, step] of [['X', -1.5, 1.5, 0.01], ['Z', -1, 1.5, 0.01], ['Yaw', -90, 90, 1]]) {
        folder.addBinding(this.params, `${prefix}${suffix}`, { min, max, step }).on('change', () => this.applyLayout())
      }
    }
  }

  destroy() {
    this.folder.dispose()
    this.plaqueLabel.destroy()
    this.cardLabel.destroy()
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.group.removeFromParent()
    this.onLayout = null
  }
}
