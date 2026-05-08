import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export default class WorldCamera {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {import('../systems/Sizes.js').default} sizes
     */
    constructor(canvas, sizes) {
        this.sizes = sizes
        this.canvas = canvas

        this.instance = new THREE.PerspectiveCamera(40, sizes.width / sizes.height, 0.05, 2000)
        this.instance.position.set(6, 3, 10)

        this.controls = new OrbitControls(this.instance, canvas)
        this.controls.enableDamping = true

        // 仅在上半球（极角从视线自 +Y 下到水平面）；方位绕 +Z 左右各 45°（总跨度为整圆的 1/4）
        this.controls.minPolarAngle = 0
        this.controls.maxPolarAngle = Math.PI / 2
        this.controls.minAzimuthAngle = -Math.PI / 4
        this.controls.maxAzimuthAngle = Math.PI / 4

        this._debugFov = { fov: this.instance.fov }
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height
        this.instance.updateProjectionMatrix()
    }

    update() {
        this.controls.update()
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active) {
            return
        }
        const folder = debug.addFolder({
            title: 'Camera',
            expanded: false
        })
        if (!folder) {
            return
        }
        folder.addBinding(this._debugFov, 'fov', { min: 10, max: 90, step: 1, label: 'FOV' }).on('change', () => {
            this.instance.fov = this._debugFov.fov
            this.instance.updateProjectionMatrix()
        })
    }

    dispose() {
        this.controls.dispose()
    }
}
