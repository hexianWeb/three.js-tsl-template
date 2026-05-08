import * as THREE from 'three/webgpu'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import Debug from '../utils/debug.js'
import Resources from '../utils/Resources.js'
import WorldCamera from '../world/camera.js'
import Environment from '../world/environment.js'
import World from '../world/world.js'
import Sizes from '../systems/Sizes.js'
import Time from '../systems/Time.js'
import Renderer from '../renderer/Renderer.js'

export default class Experience {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas

        this.debug = new Debug()
        this.sizes = new Sizes()
        this.time = new Time()
        this.renderer = new Renderer({ canvas })
        this.rendererReady = new Promise((resolve) => {
            this._resolveRendererReady = resolve
        })

        this.cssRenderer = new CSS2DRenderer()
        this.cssRenderer.domElement.className = 'css2d-overlay'
        document.body.appendChild(this.cssRenderer.domElement)

        this.scene = new THREE.Scene()
        this.worldCamera = new WorldCamera(canvas, this.sizes)
        this.scene.add(this.worldCamera.instance)

        this.world = new World(this)
        this.resources = new Resources()
        this.environment = new Environment(
            this.scene,
            this.resources,
            this.renderer.instance,
            () => this.world?.model ?? null,
            this.rendererReady
        )

        /** @type {(() => void) | null} */
        this._unsubscribeResize = null
    }

    async init() {
        this.renderer.attachPipeline(this.scene, this.worldCamera.instance)
        await this.renderer.init()
        this._resolveRendererReady()

        this.time.connectDocument(document)

        this._unsubscribeResize = this.sizes.onResize(() => {
            this.resize()
        })

        this.renderer.instance.setClearColor(this.environment.clearColor)
        this.resize()

        if (this.debug.active) {
            this.environment.debuggerInit(this.debug)
            this.worldCamera.debuggerInit(this.debug)
            this.world.debuggerInit(this.debug)
            this.renderer.debuggerInit(this.debug)
        }
    }

    resize() {
        this.worldCamera.resize()
        this.renderer.setSizeFromSizes(this.sizes)
        this.cssRenderer.setSize(this.sizes.width, this.sizes.height)
    }

    start() {
        this.renderer.instance.setAnimationLoop((timestamp) => {
            this.update(timestamp)
        })
    }

    /**
     * @param {number} timestamp
     */
    update(timestamp) {
        this.time.update(timestamp)
        this.worldCamera.update()
        this.world.update(this.time.getDelta())
        this.renderer.render()
        this.cssRenderer.render(this.scene, this.worldCamera.instance)
    }

    dispose() {
        this.renderer.instance.setAnimationLoop(null)
        this._unsubscribeResize?.()
        this._unsubscribeResize = null

        this.world.dispose()
        this.worldCamera.dispose()
        this.debug.dispose()
        this.sizes.dispose()
        this.time.dispose()

        if (typeof this.renderer.instance.dispose === 'function') {
            this.renderer.instance.dispose()
        }

        this.cssRenderer.domElement.remove()
    }
}
