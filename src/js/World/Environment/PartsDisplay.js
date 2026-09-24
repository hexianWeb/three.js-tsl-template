import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import ExhibitSample from './ExhibitSample.js'
import ExhibitLabel from './ExhibitLabel.js'

export default class PartsDisplay {
  constructor({ sources, debug }) {
    this.group = new THREE.Group()
    this.group.name = 'PartsDisplay'
    this.params = {
      boardColor: '#e3e0d9',
      shellColor: sources.plasticParams.color,
      roughness: sources.plasticParams.roughness,
      bumpStrength: sources.plasticParams.bumpStrength,
    }
    this.boardMaterial = new THREE.MeshStandardNodeMaterial({ color: this.params.boardColor, roughness: 0.65, metalness: 0 })
    this.base = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.07, 0.26, 3, 0.012), this.boardMaterial)
    this.base.position.y = 0.035
    this.board = new THREE.Mesh(new RoundedBoxGeometry(0.65, 0.66, 0.025, 3, 0.008), this.boardMaterial)
    this.board.position.set(0, 0.4, -0.025)
    for (const mesh of [this.base, this.board]) {
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.group.add(mesh)
    }
    this.label = new ExhibitLabel({ width: 0.61, height: 0.62, name: 'PartsLegend' })
    // 标签嵌在实体背板前方，保留 0.002 的深度间距，避免贴着圆角边缘或形成 Z-fighting。
    this.label.mesh.position.set(0, 0.4, -0.0105)
    this.group.add(this.label.mesh)
    this.shell = new ExhibitSample({ sources: [sources.shell], width: 0.37, height: 0.28, plasticParams: sources.plasticParams, name: 'ExhibitShell' })
    this.dpad = new ExhibitSample({ sources: [sources.buttons.dpad], width: 0.11, height: 0.11, name: 'ExhibitDpad' })
    this.buttons = new ExhibitSample({ sources: ['a', 'b', 'x', 'y'].map(key => sources.buttons[key]), width: 0.13, height: 0.13, name: 'ExhibitButtons' })
    this.shell.group.position.set(-0.1, 0.46, 0.002)
    this.dpad.group.position.set(0.2, 0.54, 0.002)
    this.buttons.group.position.set(0.2, 0.29, 0.002)
    this.group.add(this.shell.group, this.dpad.group, this.buttons.group)
    this.drawLabels()
    this.debugInit(debug)
  }

  drawLabels() {
    this.label.redraw(this.params.boardColor, (ctx, height) => {
      const text = (value, x, y, size, weight = 700, color = '#35414b') => {
        ctx.fillStyle = color
        ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillText(value, x, y)
      }
      text('01 / COMPONENT STUDY', 44, 70, 40, 800)
      ctx.strokeStyle = '#c5c6c1'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(44, 100)
      ctx.lineTo(956, 100)
      ctx.moveTo(688, 150)
      ctx.lineTo(688, 880)
      ctx.stroke()
      text('Controller Shell', 46, 698, 44, 800, '#202c36')
      text('3D Printed', 46, 746, 32)
      text('D-Pad', 728, 424, 44, 800, '#202c36')
      text('3D Printed', 728, 472, 30)
      // 右列宽度固定，拆成两行让字号真正增大，而不是把长标题横向压扁。
      text('Button', 728, 833, 40, 800, '#202c36')
      text('Caps', 728, 878, 40, 800, '#202c36')
      text('3D Printed', 728, 924, 30)
      text('DUO / MODULAR INPUT', 46, height - 35, 28)
    })
  }

  debugInit(debug) {
    this.folder = debug.ui.addFolder({ title: 'Parts Display / S2', expanded: false })
    this.folder.addBinding(this.params, 'boardColor').on('change', ({ value }) => {
      this.boardMaterial.color.set(value)
      this.drawLabels()
    })
    this.folder.addBinding(this.params, 'shellColor').on('change', ({ value }) => this.shell.setColors({ shell: value }))
    for (const [key, min, max] of [['roughness', 0.2, 0.8], ['bumpStrength', 0, 0.3]]) {
      this.folder.addBinding(this.params, key, { min, max, step: 0.01 }).on('change', () => this.shell.setFinish(this.params))
    }
  }

  destroy() {
    this.folder.dispose()
    for (const sample of [this.shell, this.dpad, this.buttons]) sample.destroy()
    this.label.destroy()
    this.base.geometry.dispose()
    this.board.geometry.dispose()
    this.boardMaterial.dispose()
    this.group.removeFromParent()
  }
}
