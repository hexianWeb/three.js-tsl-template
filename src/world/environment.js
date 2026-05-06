import * as THREE from 'three/webgpu'
import { color, fog, rangeFogFactor, uniform } from 'three/tsl'

export default class Environment {
    /**
     * @param {THREE.Scene} scene
     * @param {import('../utils/Resources.js').default} resources
     * @param {THREE.WebGPURenderer} renderer
     * @param {() => (THREE.Object3D | null)} getModel
     */
    constructor(scene, resources, renderer, getModel) {
        this.scene = scene
        this.resources = resources
        this.renderer = renderer
        this.getModel = getModel

        this.fogColor = uniform(color('#e8edf4'))
        this.fogRange = { near: 120, far: 450 }
        this._rebuildFog()

        this.keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
        this.keyLight.position.set(20, 40, 20)
        this.keyLight.castShadow = true
        this.keyLight.shadow.mapSize.set(2048, 2048)
        this.keyLight.shadow.bias = -0.0005
        this.keyLight.shadow.normalBias = 0.05
        this.scene.add(this.keyLight)
        this.scene.add(this.keyLight.target)

        this.resources.ready.then(() => this._onSourcesReady())
    }

    _onSourcesReady() {
        const hdr = this.resources.items.studioEnv
        if (!hdr) {
            console.error('[Environment] studioEnv HDR not loaded')
            return
        }
        hdr.mapping = THREE.EquirectangularReflectionMapping
        const pmrem = new THREE.PMREMGenerator(this.renderer)
        const envRT = pmrem.fromEquirectangular(hdr)
        this.scene.environment = envRT.texture
        this.scene.environmentIntensity = 1.0
        hdr.dispose()
        pmrem.dispose()
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
