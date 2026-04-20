import * as THREE from 'three/webgpu'
import { color, fog, rangeFogFactor, uniform } from 'three/tsl'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

export default class Environment {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.scene = scene

        this.loader = new RGBELoader()

        this.fogColor = uniform(color('#ffffff'))
        this.fogRange = { near: 10, far: 15 }
        this._rebuildFog()

        this.loadHDR()
    }

    loadHDR() {
        this.loader.load('hdr/citrus_orchard_road_puresky_1k.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping
            this.scene.environment = texture
            this.scene.background = texture
            this.scene.backgroundBlurriness = 0.5
        })
    }

    _rebuildFog() {
        this.scene.fogNode = fog(this.fogColor, rangeFogFactor(this.fogRange.near, this.fogRange.far))
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
            expanded: false
        })
        if (!folder) {
            return
        }
        folder.addBinding(this.fogRange, 'near', { min: 0.1, max: 50, step: 0.1, label: 'fog near' }).on('change', () => {
            this._rebuildFog()
        })
        folder.addBinding(this.fogRange, 'far', { min: 0.1, max: 80, step: 0.1, label: 'fog far' }).on('change', () => {
            this._rebuildFog()
        })
    }
}
