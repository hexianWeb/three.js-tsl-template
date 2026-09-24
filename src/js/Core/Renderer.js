import * as THREE from 'three/webgpu'
import Experience from '../Experience.js'
import ScenePipeline from './ScenePipeline.js'

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
    this.instance.toneMappingExposure = 0.84
    this.instance.shadowMap.enabled = true
    // r186 起 WebGPURenderer 已移除 PCFSoftShadowMap，PCFShadowMap 现在就是软阴影
    this.instance.shadowMap.type = THREE.PCFShadowMap
    this.resize()
    await this.instance.init()
    this.pipeline = new ScenePipeline(this.instance, this.scene, this.camera.instance, this.experience.debug)
  }

  setExposure(value) {
    this.instance.toneMappingExposure = value
  }

  update() {
    this.pipeline.update()
  }

  resize() {
    this.instance.setPixelRatio(this.sizes.pixelRatio)
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.pipeline?.resize()
  }

  destroy() {
    if (!this.instance) return

    this.instance.setAnimationLoop(null)
    this.pipeline?.destroy()
    this.instance.dispose()
  }
}
