import * as THREE from 'three/webgpu'

export default class ExhibitLabel {
  constructor({ width, height, name }) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 1024
    this.canvas.height = Math.max(128, Math.round(1024 * height / width))
    this.context = this.canvas.getContext('2d')
    if (!this.context) throw new Error('无法创建展品标签画布')
    this.logicalHeight = 1000 * height / width
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.name = `${name}_Labels`
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 8
    this.material = new THREE.MeshStandardNodeMaterial({
      name: `${name}_Label_Surface`, map: this.texture, roughness: 0.65, metalness: 0,
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material)
    this.mesh.name = name
    this.mesh.receiveShadow = true
  }

  redraw(background, draw) {
    const ctx = this.context
    ctx.setTransform(this.canvas.width / 1000, 0, 0, this.canvas.height / this.logicalHeight, 0, 0)
    ctx.fillStyle = background
    ctx.fillRect(0, 0, 1000, this.logicalHeight)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    draw(ctx, this.logicalHeight)
    // 仅构造或标签内容改变时上传，静态展示不占用 Experience 的逐帧纹理更新。
    this.texture.needsUpdate = true
  }

  destroy() {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
    this.canvas.width = 1
    this.canvas.height = 1
    this.context = null
    this.canvas = null
  }
}
