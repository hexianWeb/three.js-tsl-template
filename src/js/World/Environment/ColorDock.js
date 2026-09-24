import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import ExhibitSample from './ExhibitSample.js'
import ExhibitLabel from './ExhibitLabel.js'

export default class ColorDock {
  constructor({ sources, debug }) {
    this.group = new THREE.Group()
    this.group.name = 'ColorDock'
    this.params = {
      blue: sources.plasticParams.color,
      warmWhite: '#d9d7d0',
      graphite: '#272c32',
      roughness: sources.plasticParams.roughness,
      bumpStrength: sources.plasticParams.bumpStrength,
    }
    this.colorKeys = ['blue', 'warmWhite', 'graphite']
    this.material = new THREE.MeshStandardNodeMaterial({ color: '#dedbd4', roughness: 0.6, metalness: 0 })
    this.base = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.11, 0.33, 3, 0.012), this.material)
    this.base.position.y = 0.055
    this.base.castShadow = true
    this.base.receiveShadow = true
    this.group.add(this.base)
    this.seatGeometry = new RoundedBoxGeometry(0.185, 0.012, 0.09, 2, 0.003)
    this.samples = this.colorKeys.map((key, index) => {
      const sample = new ExhibitSample({
        sources: [sources.shell], width: 0.18, height: 0.27, rotation: Math.PI / 2,
        plasticParams: { ...sources.plasticParams, color: this.params[key] }, name: `Dock_${key}`,
      })
      // 只在展示坐标内把真实外壳竖放；按实际高度落到承托面，不改源几何或安装矩阵。
      sample.group.position.set((index - 1) * 0.205, 0.114 + sample.size.y / 2, -sample.size.z / 2)
      const seat = new THREE.Mesh(this.seatGeometry, this.material)
      seat.position.set((index - 1) * 0.205, 0.116, 0)
      seat.castShadow = true
      seat.receiveShadow = true
      this.group.add(sample.group, seat)
      return sample
    })
    this.label = new ExhibitLabel({ width: 0.57, height: 0.065, name: 'ColorStudiesLegend' })
    this.label.mesh.position.set(0, 0.057, 0.1665)
    this.group.add(this.label.mesh)
    this.applyColors()
    this.debugInit(debug)
  }

  applyColors() {
    this.samples.forEach((sample, index) => sample.setColor(this.params[this.colorKeys[index]]))
    this.label.redraw('#e7e3dc', (ctx) => {
      ctx.fillStyle = '#343b41'
      ctx.font = '600 35px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText('Color Studies', 30, 49)
      ctx.fillStyle = '#60686c'
      ctx.font = '400 21px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText('02 / CONTROLLER SHELL', 30, 83)
      this.colorKeys.forEach((key, index) => {
        const x = 622 + index * 145
        ctx.fillStyle = this.params[key]
        ctx.beginPath()
        ctx.arc(x, 42, 17, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#b2b5b1'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = '#4b5359'
        ctx.textAlign = 'center'
        ctx.font = '400 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillText(['Blue', 'Warm White', 'Graphite'][index], x, 86)
      })
    })
  }

  debugInit(debug) {
    this.folder = debug.ui.addFolder({ title: 'Color Dock / S2', expanded: false })
    for (const key of this.colorKeys) this.folder.addBinding(this.params, key).on('change', () => this.applyColors())
    for (const [key, min, max] of [['roughness', 0.2, 0.8], ['bumpStrength', 0, 0.3]]) {
      this.folder.addBinding(this.params, key, { min, max, step: 0.01 })
        .on('change', () => this.samples.forEach(sample => sample.setFinish(this.params)))
    }
  }

  destroy() {
    this.folder.dispose()
    this.samples.forEach(sample => sample.destroy())
    this.label.destroy()
    this.base.geometry.dispose()
    this.seatGeometry.dispose()
    this.material.dispose()
    this.group.removeFromParent()
  }
}
