import * as THREE from 'three/webgpu'
import { color, fog, rangeFogFactor, uniform } from 'three/tsl'

export default class Environment {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.scene = scene

        this.fogColor = uniform(color('#e8edf4'))
        this.fogRange = { near: 120, far: 450 }
        this._rebuildFog()

        const hemi = new THREE.HemisphereLight(0xffffff, 0x6a7080, 1.05)
        this.scene.add(hemi)

        const dir = new THREE.DirectionalLight(0xffffff, 2)
        dir.position.set(6, 12, 8)
        this.scene.add(dir)
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
        folder.addBinding(this.fogRange, 'near', { min: 0.1, max: 400, step: 1, label: 'fog near' }).on('change', () => {
            this._rebuildFog()
        })
        folder.addBinding(this.fogRange, 'far', { min: 1, max: 800, step: 1, label: 'fog far' }).on('change', () => {
            this._rebuildFog()
        })
    }
}
