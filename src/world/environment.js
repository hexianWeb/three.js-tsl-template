import * as THREE from 'three/webgpu'
import { color, uniform } from 'three/tsl'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

export default class Environment {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.scene = scene

        this.loader = new HDRLoader()

        this.envParams = {
            backgroundBlurriness: 0.5,
            backgroundIntensity: 1.0,
            environmentIntensity: 1.0
        }

        this.loadHDR()
    }

    loadHDR() {
        this.loader.load('./hdr/studio_small_08_1k.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping
            this.scene.environment = texture
            this.scene.background = texture

            this.scene.backgroundBlurriness = this.envParams.backgroundBlurriness
            this.scene.backgroundIntensity = this.envParams.backgroundIntensity
            this.scene.environmentIntensity = this.envParams.environmentIntensity
        })
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

        folder.addBinding(this.envParams, 'backgroundBlurriness', { min: 0, max: 1, step: 0.01 }).on('change', () => {
            this.scene.backgroundBlurriness = this.envParams.backgroundBlurriness
        })
        folder.addBinding(this.envParams, 'backgroundIntensity', { min: 0, max: 5, step: 0.1 }).on('change', () => {
            this.scene.backgroundIntensity = this.envParams.backgroundIntensity
        })
        folder.addBinding(this.envParams, 'environmentIntensity', { min: 0, max: 5, step: 0.1 }).on('change', () => {
            this.scene.environmentIntensity = this.envParams.environmentIntensity
        })
    }
}
