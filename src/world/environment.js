import * as THREE from 'three/webgpu'

export default class Environment {
    /**
     * @param {THREE.Scene} scene
     * @param {import('../utils/Resources.js').default} resources
     * @param {THREE.WebGPURenderer} renderer
     * @param {() => (THREE.Object3D | null)} getModel
     * @param {Promise<void>} rendererReady
     */
    constructor(scene, resources, renderer, getModel, rendererReady = Promise.resolve()) {
        this.scene = scene
        this.resources = resources
        this.renderer = renderer
        this.getModel = getModel

        /** Same instance as {@link THREE.Scene#background}; also used for renderer clear color. */
        this.clearColor = new THREE.Color('#424446')
        this.scene.background = this.clearColor
        /** Initial key light direction (deg). Applied in constructor and after model fit. */
        this.keyLightState = {
            intensity: 2.5,
            azimuthDeg: -45,
            elevationDeg: 66
        }
        this._keyLightDefaultDistance = Math.hypot(20, 40, 20)

        this.keyLight = new THREE.DirectionalLight(0xffffff, this.keyLightState.intensity)
        this.keyLight.target.position.set(0, 0, 0)
        this._applyKeyLightFromState(this._keyLightDefaultDistance)
        this.keyLight.castShadow = true
        this.keyLight.shadow.mapSize.set(2048, 2048)
        this.keyLight.shadow.bias = -0.0005
        this.keyLight.shadow.normalBias = 0.05
        this.scene.add(this.keyLight)
        this.scene.add(this.keyLight.target)

        Promise.all([this.resources.ready, rendererReady]).then(() => this._onSourcesReady())
    }

    /**
     * Place key light at `target + dir(azimuth, elevation) * radius`.
     * @param {number} [radius]
     */
    _applyKeyLightFromState(radius) {
        const { azimuthDeg, elevationDeg, intensity } = this.keyLightState
        const az = THREE.MathUtils.degToRad(azimuthDeg)
        const el = THREE.MathUtils.degToRad(elevationDeg)
        const target = this.keyLight.target.position
        const center = target
        const dir = new THREE.Vector3(
            Math.cos(el) * Math.cos(az),
            Math.sin(el),
            Math.cos(el) * Math.sin(az)
        )
        let r = radius
        if (r === undefined || r === null) {
            r = this.keyLight.position.distanceTo(target)
            if (r < 1e-6) r = this._keyLightDefaultDistance
        }
        this.keyLight.position.copy(center).addScaledVector(dir, r)
        this.keyLight.intensity = intensity
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

        const dist = radius * 2
        this.keyLight.target.position.copy(center)
        this.keyLight.target.updateMatrixWorld()
        this._applyKeyLightFromState(dist)

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

        const bgState = { color: `#${this.clearColor.getHexString()}` }
        folder
            .addBinding(bgState, 'color', { view: 'color', label: '背景色' })
            .on('change', (ev) => {
                this.clearColor.set(ev.value)
                this.renderer.setClearColor(this.clearColor)
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

        const applyLightDir = () => this._applyKeyLightFromState()
        folder
            .addBinding(this.keyLightState, 'intensity', { min: 0, max: 10, step: 0.05, label: 'key intensity' })
            .on('change', (ev) => {
                this.keyLight.intensity = ev.value
            })
        folder
            .addBinding(this.keyLightState, 'azimuthDeg', { min: -180, max: 180, step: 1, label: 'key azimuth' })
            .on('change', applyLightDir)
        folder
            .addBinding(this.keyLightState, 'elevationDeg', { min: 5, max: 89, step: 1, label: 'key elevation' })
            .on('change', applyLightDir)
    }
}
