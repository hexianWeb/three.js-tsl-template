import * as THREE from 'three/webgpu'
import Experience from '../Experience.js'
import ScenePipeline from './ScenePipeline.js'
import TransmissionBackdrop from './TransmissionBackdrop.js'

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
    this.instance.toneMappingExposure = 1.03
    this.instance.shadowMap.enabled = true
    // r186 起 WebGPURenderer 已移除 PCFSoftShadowMap，PCFShadowMap 现在就是软阴影
    this.instance.shadowMap.type = THREE.PCFShadowMap
    this.resize()
    await this.instance.init()
    this.pipeline = new ScenePipeline(this.instance, this.scene, this.camera.instance, this.experience.debug)
    this.transmissionBackdrop = new TransmissionBackdrop(this.instance, this.scene, this.camera.instance)
  }

  setExposure(value) {
    this.instance.toneMappingExposure = value
  }

  async initPointerOverlay({ canvas, scene, camera, surfaceWidth, surfaceHeight }) {
    // 小型透明画布和主渲染器共享 GPUDevice，独立灯光让白色笔身不受展区镜头/后处理影响。
    const instance = new THREE.WebGPURenderer({
      canvas, alpha: true, antialias: true, forceWebGL: false, device: this.instance.backend.device,
    })
    const overlay = { instance, scene, camera, canvas, ready: false, surfaceWidth, surfaceHeight }
    this.pointerOverlay = overlay
    instance.toneMapping = THREE.ACESFilmicToneMapping
    instance.toneMappingExposure = 0.95
    instance.setClearColor(0x000000, 0)
    instance.setPixelRatio(this.sizes.pixelRatio)
    instance.setSize(surfaceWidth, surfaceHeight, false)
    await instance.init()
    if (this.destroyed) {
      instance.dispose()
      return
    }
    await instance.compileAsync(scene, camera)
    if (this.destroyed) {
      instance.dispose()
      return
    }
    overlay.ready = true
    instance.render(scene, camera)
  }

  update() {
    // Camera.update 已在 Experience 中完成；每帧仅在最终镜头下捕获一次玻璃背景。
    if (!this.pipeline.params.enabled || this.pipeline.params.view === 'scene') this.transmissionBackdrop.capture()
    this.pipeline.update()
    // 与主场景共用 Experience 循环，不另起 rAF；透明小画布只绘制鼠标伴随模型。
    if (this.pointerOverlay?.ready && !this.pointerOverlay.canvas.hidden) {
      const { instance, scene, camera } = this.pointerOverlay
      instance.render(scene, camera)
    }
  }

  resize() {
    this.instance.setPixelRatio(this.sizes.pixelRatio)
    // CSS 决定页头下方的可用区域，渲染器仅更新像素缓冲，避免反过来撑大 Flex 画布。
    this.instance.setSize(this.sizes.width, this.sizes.height, false)
    this.pipeline?.resize()
    this.transmissionBackdrop?.resize()
    if (this.pointerOverlay?.ready) {
      const { instance, surfaceWidth, surfaceHeight } = this.pointerOverlay
      instance.setPixelRatio(this.sizes.pixelRatio)
      instance.setSize(surfaceWidth, surfaceHeight, false)
    }
  }

  destroy() {
    this.destroyed = true
    // 共享 Device 的次级渲染器先释放；只有主渲染器负责最终销毁 Device。
    if (this.pointerOverlay?.ready) this.pointerOverlay.instance.dispose()
    if (!this.instance) return

    this.instance.setAnimationLoop(null)
    this.pipeline?.destroy()
    this.transmissionBackdrop?.destroy()
    this.instance.dispose()
  }
}
