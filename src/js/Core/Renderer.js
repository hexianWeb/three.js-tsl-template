import * as THREE from 'three/webgpu'
import Experience from '../Experience.js'

export default class Renderer {
  constructor() {
    this.experience = new Experience()
    this.canvas = this.experience.canvas
    this.scene = this.experience.scene
    this.camera = this.experience.camera
    this.sizes = this.experience.sizes
  }

  async init() {
    this.instance = new THREE.WebGPURenderer({
      antialias: true,
      canvas: this.canvas,
      forceWebGL: false,
    })
    this.instance.toneMapping = THREE.ACESFilmicToneMapping
    this.instance.toneMappingExposure = 1.1
    this.instance.shadowMap.enabled = true
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap
    this.resize()
    await this.instance.init()
  }

  update() {
    this.instance.render(this.scene, this.camera.instance)
  }

  resize() {
    this.instance.setPixelRatio(this.sizes.pixelRatio)
    this.instance.setSize(this.sizes.width, this.sizes.height)
  }

  destroy() {
    if (!this.instance) return

    this.instance.setAnimationLoop(null)
    this.instance.dispose()
  }
}
