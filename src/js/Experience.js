import * as THREE from 'three/webgpu'
import Camera from './Core/Camera.js'
import Debug from './Core/Debug.js'
import Renderer from './Core/Renderer.js'
import EventBus from './Utils/EventBus.js'
import Resources from './Utils/Resources.js'
import Sizes from './Utils/Sizes.js'
import State from './Utils/State.js'
import Time from './Utils/Time.js'
import World from './World/World.js'
import sources from './sources.js'

export default class Experience {
  static instance

  constructor(options = {}) {
    if (Experience.instance) return Experience.instance

    if (!options.canvas) {
      throw new Error('首次创建 Experience 时必须提供 Canvas。')
    }

    Experience.instance = this
    this.canvas = options.canvas
    this.debugPanel = options.debugPanel
    this.events = new EventBus()
    this.state = new State()
    this.sizes = new Sizes()
    this.time = new Time()
    this.scene = new THREE.Scene()
    this.debug = new Debug(this.debugPanel)
    this.update = this.update.bind(this)
    this.resize = this.resize.bind(this)
    this.removeResizeListener = this.sizes.onResize(this.resize)
    this.initialized = false
    this.destroyed = false
  }

  async init() {
    if (this.initialized) return this

    this.camera = new Camera()
    this.renderer = new Renderer()
    await this.renderer.init()

    this.resources = new Resources(sources)
    await this.resources.load()

    this.world = new World()
    this.renderer.instance.setAnimationLoop(this.update)
    this.world.start()
    this.initialized = true
    return this
  }

  update() {
    this.time.update()
    this.world.update()
    this.camera.update()
    this.renderer.update()
  }

  resize() {
    this.camera?.resize()
    this.renderer?.resize()
  }

  destroy() {
    if (this.destroyed) return

    this.destroyed = true
    this.removeResizeListener?.()
    this.renderer?.instance?.setAnimationLoop(null)
    this.world?.destroy()
    this.camera?.destroy()
    this.renderer?.destroy()
    this.debug?.destroy()
    this.time.destroy()
    this.sizes.destroy()
    this.events.destroy()
    this.scene.clear()
    Experience.instance = null
  }
}
