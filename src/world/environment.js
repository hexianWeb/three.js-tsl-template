import * as THREE from 'three/webgpu'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

export default class Environment {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.OrthographicCamera} camera
     */
    constructor(scene, camera) {
        this.scene = scene
        this.camera = camera

        this.loader = new HDRLoader()
        this.textureLoader = new THREE.TextureLoader()

        this.backgroundDistance = -10
        this.backgroundTexture = null
        this.backgroundPlane = null
        this.backgroundViewWidth = 0
        this.backgroundViewHeight = 0

        this.envParams = {
            environmentIntensity: 1.0 * 0.7
        }

        this.ambientLight = new THREE.AmbientLight(0x8844ff, 0.1)
        this.scene.add(this.ambientLight)

        this.createBackgroundPlane()
        this.loadHDR()
    }

    createBackgroundPlane() {
        const texture = this.textureLoader.load('./texture/background2.png', () => {
            this.fitBackgroundTexture()
        })
        texture.colorSpace = THREE.SRGBColorSpace

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
        })

        const geometry = new THREE.PlaneGeometry(1, 1)
        const plane = new THREE.Mesh(geometry, material)
        plane.name = 'SceneBackgroundPlane'
        plane.position.set(0, 0, this.backgroundDistance)
        plane.renderOrder = -1000
        plane.frustumCulled = false
        plane.onBeforeRender = () => {
            this.resize()
        }

        this.backgroundTexture = texture
        this.backgroundPlane = plane
        this.camera.add(plane)
        this.resize()
    }

    loadHDR() {
        this.loader.load('./hdr/rogland_clear_night_1k.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping
            this.scene.environment = texture
            this.scene.background = null
            this.scene.environmentIntensity = this.envParams.environmentIntensity
        })
    }

    resize() {
        if (!this.backgroundPlane) {
            return
        }

        const width = (this.camera.right - this.camera.left) / this.camera.zoom
        const height = (this.camera.top - this.camera.bottom) / this.camera.zoom
        if (width === this.backgroundViewWidth && height === this.backgroundViewHeight) {
            return
        }

        this.backgroundViewWidth = width
        this.backgroundViewHeight = height
        this.backgroundPlane.scale.set(width, height, 1)
        this.fitBackgroundTexture()
    }

    fitBackgroundTexture() {
        const texture = this.backgroundTexture
        const image = texture?.image
        if (!texture || !image?.width || !image?.height) {
            return
        }

        const viewAspect = (this.camera.right - this.camera.left) / (this.camera.top - this.camera.bottom)
        const imageAspect = image.width / image.height

        if (imageAspect > viewAspect) {
            const repeatX = viewAspect / imageAspect
            texture.repeat.set(repeatX, 1)
            texture.offset.set((1 - repeatX) * 0.5, 0)
        } else {
            const repeatY = imageAspect / viewAspect
            texture.repeat.set(1, repeatY)
            texture.offset.set(0, (1 - repeatY) * 0.5)
        }

        texture.needsUpdate = true
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active) {
            return
        }
        const folder = debug.addFolder({
            title: 'Environment',
            expanded: true
        })
        if (!folder) {
            return
        }

        folder.addBinding(this.envParams, 'environmentIntensity', { min: 0, max: 5, step: 0.1 }).on('change', () => {
            this.scene.environmentIntensity = this.envParams.environmentIntensity
        })
    }

    dispose() {
        if (this.backgroundPlane) {
            this.camera.remove(this.backgroundPlane)
            this.backgroundPlane.geometry.dispose()
            this.backgroundPlane.material.dispose()
        }

        this.backgroundTexture?.dispose()
        this.backgroundTexture = null
        this.backgroundPlane = null
    }
}
