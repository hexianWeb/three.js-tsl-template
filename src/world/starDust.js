import * as THREE from 'three/webgpu'
import {
    float,
    fract,
    instanceIndex,
    length,
    pow,
    saturate,
    sin,
    smoothstep,
    time,
    uniform,
    uv,
    vec2,
} from 'three/tsl'

const FAR_LAYER_DEPTH = -9.2

export default class StarDust {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     */
    constructor(scene, camera) {
        this.scene = scene
        this.camera = camera

        this.params = {
            farCount: 420,
            nearCount: 90,
            farColor: '#9fc7ff',
            nearColor: '#c7f5ff',
            farOpacity: 0.34,
            nearOpacity: 0.62,
            twinkleIntensity: 0.85,
            twinkleSpeed: 1.15,
            driftSpeed: 0.035,
        }

        this._uniforms = {
            farColor: uniform(new THREE.Color(this.params.farColor)),
            nearColor: uniform(new THREE.Color(this.params.nearColor)),
            farOpacity: uniform(this.params.farOpacity),
            nearOpacity: uniform(this.params.nearOpacity),
            twinkleIntensity: uniform(this.params.twinkleIntensity),
            twinkleSpeed: uniform(this.params.twinkleSpeed),
        }

        this.group = new THREE.Group()
        this.group.name = 'StarDust'
        this.nearGroup = new THREE.Group()
        this.nearGroup.name = 'NearStarDust'

        this.create()
    }

    create() {
        this.disposeMeshes()

        this.farGeometry = new THREE.PlaneGeometry(1, 1)
        this.nearGeometry = new THREE.PlaneGeometry(1, 1)
        this.farMaterial = this._createMaterial(this._uniforms.farColor, this._uniforms.farOpacity, false)
        this.nearMaterial = this._createMaterial(this._uniforms.nearColor, this._uniforms.nearOpacity, true)

        this.farMesh = new THREE.InstancedMesh(this.farGeometry, this.farMaterial, this.params.farCount)
        this.farMesh.name = 'FarStarDust'
        this.farMesh.renderOrder = -900
        this._setFarMatrices(this.farMesh)

        this.nearMesh = new THREE.InstancedMesh(this.nearGeometry, this.nearMaterial, this.params.nearCount)
        this.nearMesh.name = 'NearStarDust'
        this.nearMesh.renderOrder = 20
        this._setNearMatrices(this.nearMesh)

        this.group.add(this.farMesh)
        this.nearGroup.add(this.nearMesh)
        this.camera.add(this.group)
        this.scene.add(this.nearGroup)
    }

    _createMaterial(colorUniform, opacityUniform, useDepthTest) {
        const idx = instanceIndex.toFloat()
        const hash = fract(sin(idx.mul(12.9898)).mul(43758.5453))
        const phase = fract(sin(idx.mul(39.3467)).mul(27183.7151)).mul(Math.PI * 2)
        const twinkle = sin(time.mul(this._uniforms.twinkleSpeed).add(phase)).mul(0.5).add(0.5)
        const sparkle = pow(saturate(twinkle), float(3.2))
        const intensity = float(0.55).add(sparkle.mul(this._uniforms.twinkleIntensity)).add(hash.mul(0.32))

        const centeredUv = uv().sub(vec2(0.5))
        const radius = length(centeredUv).mul(2)
        const disk = smoothstep(float(1), float(0.12), radius)
        const core = pow(saturate(float(1).sub(radius)), float(8))
        const alpha = saturate(disk.add(core)).mul(opacityUniform).mul(intensity)

        const material = new THREE.MeshBasicNodeMaterial()
        material.transparent = true
        material.depthTest = useDepthTest
        material.depthWrite = false
        material.blending = THREE.AdditiveBlending
        material.side = THREE.DoubleSide
        material.toneMapped = false
        material.colorNode = colorUniform.mul(intensity)
        material.opacityNode = alpha

        return material
    }

    /**
     * @param {THREE.InstancedMesh} mesh
     */
    _setFarMatrices(mesh) {
        const matrix = new THREE.Matrix4()
        const position = new THREE.Vector3()
        const quaternion = new THREE.Quaternion()
        const scale = new THREE.Vector3()

        for (let i = 0; i < this.params.farCount; i++) {
            const x = this._randomRange(-2.9, 2.9)
            const y = this._randomRange(-1.55, 1.55)
            const avoidCenter = Math.hypot(x / 1.55, y / 0.92) < 0.92
            const size = this._randomRange(0.004, avoidCenter ? 0.008 : 0.014)

            position.set(x, y, FAR_LAYER_DEPTH + this._randomRange(-0.03, 0.03))
            scale.setScalar(size)
            matrix.compose(position, quaternion, scale)
            mesh.setMatrixAt(i, matrix)
        }

        mesh.instanceMatrix.needsUpdate = true
    }

    /**
     * @param {THREE.InstancedMesh} mesh
     */
    _setNearMatrices(mesh) {
        const matrix = new THREE.Matrix4()
        const quaternion = new THREE.Quaternion()
        const scale = new THREE.Vector3()
        const position = new THREE.Vector3()
        const normal = new THREE.Vector3()
        const zAxis = new THREE.Vector3(0, 0, 1)

        for (let i = 0; i < this.params.nearCount; i++) {
            const radius = this._randomRange(1.55, 2.55)
            const theta = this._randomRange(0, Math.PI * 2)
            const phi = Math.acos(this._randomRange(-0.82, 0.82))

            position.set(
                Math.sin(phi) * Math.cos(theta) * radius,
                Math.cos(phi) * radius * 0.72,
                Math.sin(phi) * Math.sin(theta) * radius,
            )

            normal.copy(position).normalize()
            quaternion.setFromUnitVectors(zAxis, normal)
            scale.setScalar(this._randomRange(0.006, 0.018))
            matrix.compose(position, quaternion, scale)
            mesh.setMatrixAt(i, matrix)
        }

        mesh.instanceMatrix.needsUpdate = true
    }

    /**
     * @param {number} min
     * @param {number} max
     */
    _randomRange(min, max) {
        return min + Math.random() * (max - min)
    }

    _syncUniforms() {
        this._uniforms.farColor.value.set(this.params.farColor)
        this._uniforms.nearColor.value.set(this.params.nearColor)
        this._uniforms.farOpacity.value = this.params.farOpacity
        this._uniforms.nearOpacity.value = this.params.nearOpacity
        this._uniforms.twinkleIntensity.value = this.params.twinkleIntensity
        this._uniforms.twinkleSpeed.value = this.params.twinkleSpeed
    }

    /**
     * @param {number} delta
     */
    update(delta = 0) {
        this.nearGroup.rotation.y += delta * this.params.driftSpeed
        this.nearGroup.rotation.x += delta * this.params.driftSpeed * 0.28
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active) return
        const folder = debug.addFolder({ title: 'Star Dust' })
        if (!folder) return

        folder.addBinding(this.params, 'farColor', { view: 'color' }).on('change', () => this._syncUniforms())
        folder.addBinding(this.params, 'nearColor', { view: 'color' }).on('change', () => this._syncUniforms())
        folder.addBinding(this.params, 'farOpacity', { min: 0, max: 1.5, step: 0.01 }).on('change', () => this._syncUniforms())
        folder.addBinding(this.params, 'nearOpacity', { min: 0, max: 2, step: 0.01 }).on('change', () => this._syncUniforms())
        folder.addBinding(this.params, 'twinkleIntensity', { min: 0, max: 2, step: 0.01 }).on('change', () => this._syncUniforms())
        folder.addBinding(this.params, 'twinkleSpeed', { min: 0, max: 5, step: 0.01 }).on('change', () => this._syncUniforms())
        folder.addBinding(this.params, 'driftSpeed', { min: 0, max: 0.2, step: 0.001 })
    }

    disposeMeshes() {
        if (this.farMesh) {
            this.group.remove(this.farMesh)
            this.farGeometry.dispose()
            this.farMaterial.dispose()
            this.farMesh = null
            this.farGeometry = null
            this.farMaterial = null
        }

        if (this.nearMesh) {
            this.nearGroup.remove(this.nearMesh)
            this.nearGeometry.dispose()
            this.nearMaterial.dispose()
            this.nearMesh = null
            this.nearGeometry = null
            this.nearMaterial = null
        }
    }

    dispose() {
        this.disposeMeshes()
        this.camera.remove(this.group)
        this.scene.remove(this.nearGroup)
    }
}
