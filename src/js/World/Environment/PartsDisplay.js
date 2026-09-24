import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import ExhibitSample from './ExhibitSample.js'
import ExhibitLabel from './ExhibitLabel.js'
import GlassPhysicalNodeMaterial from '../../Materials/Transmission/GlassPhysicalNodeMaterial.js'

export default class PartsDisplay {
  constructor({ sources, debug, transmissionBackdrop }) {
    this.transmissionBackdrop = transmissionBackdrop
    this.group = new THREE.Group()
    this.group.name = 'PartsDisplay'
    this.params = {
      boardColor: '#e5eeeb',
      glassTransmission: 0.88,
      glassRoughness: 0.12,
      glassIor: 1.45,
      glassThickness: 0.025,
      glassDispersion: 0.5,
      glassBlur: 0.12,
      glassSamples: 4,
      shellColor: sources.plasticParams.color,
      roughness: sources.plasticParams.roughness,
      bumpStrength: sources.plasticParams.bumpStrength,
    }
    this.baseMaterial = new THREE.MeshStandardNodeMaterial({ color: '#e3e0d9', roughness: 0.65 })
    this.boardMaterial = new GlassPhysicalNodeMaterial(transmissionBackdrop.getTextureNode(), this.params)
    this.base = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.07, 0.26, 3, 0.012), this.baseMaterial)
    this.base.position.y = 0.035
    this.board = new THREE.Mesh(new RoundedBoxGeometry(0.65, 0.66, 0.025, 3, 0.008), this.boardMaterial)
    this.board.position.set(0, 0.4, -0.025)
    for (const mesh of [this.base, this.board]) {
      // 透射玻璃不投不透明矩形阴影；transparent 同时让 GTAO 预通道跳过整块背板。
      mesh.castShadow = mesh === this.base
      mesh.receiveShadow = true
      this.group.add(mesh)
    }
    this.label = new ExhibitLabel({ width: 0.61, height: 0.62, name: 'PartsLegend', cutout: true })
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
    this.unregisterGlass = transmissionBackdrop.register(this.board, [this.label.mesh, this.shell.group, this.dpad.group, this.buttons.group])
    this.drawLabels()
    this.debugInit(debug)
  }

  drawLabels() {
    this.label.redraw(null, (ctx, height) => {
      // 仅文字周围有暖白纸签，其余像素透明，透出竖板后的环境与接触层次。
      ctx.fillStyle = '#f0eee7'
      for (const [x, y, width, h] of [[28, 20, 590, 65], [30, 647, 425, 115], [711, 372, 255, 116], [711, 787, 255, 153], [30, height - 72, 390, 50]]) {
        ctx.fillRect(x, y, width, h)
      }
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
    })
    const glass = this.folder.addFolder({ title: 'WebGPU transmission' })
    for (const [key, min, max, step] of [
      ['glassTransmission', 0, 1, 0.01], ['glassRoughness', 0, 0.6, 0.01],
      ['glassIor', 1, 2, 0.01], ['glassThickness', 0.001, 0.15, 0.001],
      ['glassDispersion', 0, 10, 0.1], ['glassBlur', 0, 1, 0.01],
    ]) glass.addBinding(this.params, key, { min, max, step }).on('change', () => this.boardMaterial.setOptics(this.params))
    glass.addBinding(this.params, 'glassSamples', { options: { Low: 2, Medium: 4, High: 8 } })
      .on('change', ({ value }) => this.boardMaterial.setSamples(value))
    glass.addBinding(this.transmissionBackdrop.params, 'resolutionScale', { min: 0.25, max: 1, step: 0.25, label: 'Backdrop scale' })
      .on('change', () => this.transmissionBackdrop.resize())
    glass.addBinding(this.transmissionBackdrop.params, 'backside', { label: 'Backside pass' })
    glass.addBinding(this.transmissionBackdrop.params, 'backsideThickness', { min: 0.001, max: 0.1, step: 0.001 })
    this.folder.addBinding(this.params, 'shellColor').on('change', ({ value }) => this.shell.setColors({ shell: value }))
    for (const [key, min, max] of [['roughness', 0.2, 0.8], ['bumpStrength', 0, 0.3]]) {
      this.folder.addBinding(this.params, key, { min, max, step: 0.01 }).on('change', () => this.shell.setFinish(this.params))
    }
  }

  destroy() {
    this.unregisterGlass()
    this.folder.dispose()
    for (const sample of [this.shell, this.dpad, this.buttons]) sample.destroy()
    this.label.destroy()
    this.base.geometry.dispose()
    this.board.geometry.dispose()
    this.boardMaterial.dispose()
    this.baseMaterial.dispose()
    this.group.removeFromParent()
  }
}
