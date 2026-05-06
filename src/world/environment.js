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

        const model = this.getModel?.()
        if (model) {
            this._fitKeyLightToModel(model)
        }
    }

    /**
     * @param {THREE.Object3D} object
     */
    _fitKeyLightToModel(object) {
        const box = new THREE.Box3().setFromObject(object)
        if (box.isEmpty()) return

        const center = box.getCenter(new THREE.Vector3())
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        const radius = sphere.radius

        const dir = new THREE.Vector3(0.5, 1.5, 0.5).normalize()
        const dist = radius * 2

        this.keyLight.position.copy(center).addScaledVector(dir, dist)
        this.keyLight.target.position.copy(center)
        this.keyLight.target.updateMatrixWorld()

        const margin = radius * 1.1
        const cam = this.keyLight.shadow.camera
        cam.left = -margin
        cam.right = margin
        cam.top = margin
        cam.bottom = -margin
        cam.near = Math.max(0.5, dist - radius * 1.2)
        cam.far = dist + radius * 1.2
        cam.updateProjectionMatrix()
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

        const envState = { intensity: this.scene.environmentIntensity ?? 1 }
        folder
            .addBinding(envState, 'intensity', { min: 0, max: 3, step: 0.01, label: 'env intensity' })
            .on('change', (ev) => {
                this.scene.environmentIntensity = ev.value
            })

        const tmState = { exposure: this.renderer.toneMappingExposure }
        folder
            .addBinding(tmState, 'exposure', { min: 0, max: 3, step: 0.01, label: 'tonemap exposure' })
            .on('change', (ev) => {
                this.renderer.toneMappingExposure = ev.value
            })

        const lightState = {
            intensity: this.keyLight.intensity,
            azimuthDeg: 45,
            elevationDeg: 60
        }
        const applyLightDir = () => {
            const az = THREE.MathUtils.degToRad(lightState.azimuthDeg)
            const el = THREE.MathUtils.degToRad(lightState.elevationDeg)
            const target = this.keyLight.target.position
            const center = target.clone()
            const radius = this.keyLight.position.distanceTo(target)
            const dir = new THREE.Vector3(
                Math.cos(el) * Math.cos(az),
                Math.sin(el),
                Math.cos(el) * Math.sin(az)
            )
            this.keyLight.position.copy(center).addScaledVector(dir, radius || 1)
        }
        folder
            .addBinding(lightState, 'intensity', { min: 0, max: 10, step: 0.05, label: 'key intensity' })
            .on('change', (ev) => {
                this.keyLight.intensity = ev.value
            })
        folder
            .addBinding(lightState, 'azimuthDeg', { min: -180, max: 180, step: 1, label: 'key azimuth' })
            .on('change', applyLightDir)
        folder
            .addBinding(lightState, 'elevationDeg', { min: 5, max: 89, step: 1, label: 'key elevation' })
            .on('change', applyLightDir)
    }
}
