import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'

/**
 * Fibonacci-sampled point cloud on the unit sphere, filtered by a land mask texture.
 */
export default class DotSphere {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.scene = scene

        this.panelParams = {
            pointsNumber: 15000,
            landThreshold: 0.5,
            dotSize: 0.01
        }

        this._landMaskPromise = this._loadLandMask('texture/earth.jpg')
        this.createDotSphere()
    }

    async _loadLandMask(url) {
        const img = new Image()
        img.src = url
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0)
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        return { data, width: canvas.width, height: canvas.height }
    }

    _sampleIsLand(mask, u, v) {
        const x = Math.min(mask.width - 1, Math.max(0, Math.floor(u * mask.width)))
        const y = Math.min(mask.height - 1, Math.max(0, Math.floor(v * mask.height)))
        const idx = (y * mask.width + x) * 4
        const lum = (mask.data[idx] + mask.data[idx + 1] + mask.data[idx + 2]) / (3 * 255)
        return lum < this.panelParams.landThreshold
    }

    _dispose() {
        if (!this.mesh) return
        this.scene.remove(this.mesh)
        this.geometry.dispose()
        this.material.dispose()
        this.mesh = null
        this.geometry = null
        this.material = null
    }

    async createDotSphere() {
        const mask = await this._landMaskPromise
        this._dispose()

        const n = Math.max(1, Math.round(this.panelParams.pointsNumber))
        this.panelParams.pointsNumber = n

        const goldenRatio = (Math.sqrt(5) + 1) / 2
        /** @type {number[][]} */
        const positions = []

        for (let i = 0; i < n; i++) {
            const prog = i / n
            const theta = (2 * Math.PI * i) / goldenRatio
            const phi = Math.acos(1 - 2 * prog)
            const x = Math.sin(phi) * Math.cos(theta)
            const y = Math.sin(phi) * Math.sin(theta)
            const z = Math.cos(phi)

            const lon = Math.atan2(z, x)
            const lat = Math.asin(y)
            const u = lon / (2 * Math.PI) + 0.5
            const v = 0.5 - lat / Math.PI

            if (this._sampleIsLand(mask, u, v)) {
                positions.push([x, y, z])
            }
        }

        const count = positions.length
        if (count === 0) return

        const material = new THREE.MeshBasicNodeMaterial()
        material.colorNode = color(0xff0000)

        const size = Math.max(0.001, this.panelParams.dotSize)
        this.panelParams.dotSize = size
        const geometry = new THREE.PlaneGeometry(size, size)
        const dots = new THREE.InstancedMesh(geometry, material, count)

        const matrix = new THREE.Matrix4()
        const quat = new THREE.Quaternion()
        const scale = new THREE.Vector3(1, 1, 1)
        const pos = new THREE.Vector3()
        const normal = new THREE.Vector3()
        const zAxis = new THREE.Vector3(0, 0, 1)

        for (let i = 0; i < count; i++) {
            const [x, y, z] = positions[i]
            pos.set(x, y, z)
            normal.copy(pos).normalize()
            quat.setFromUnitVectors(zAxis, normal)
            matrix.compose(pos, quat, scale)
            dots.setMatrixAt(i, matrix)
        }
        dots.instanceMatrix.needsUpdate = true

        this.geometry = geometry
        this.material = material
        this.mesh = dots
        this.scene.add(dots)
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active) return

        const folder = debug.addFolder({ title: 'Dot sphere' })
        if (!folder) return

        folder.addBinding(this.panelParams, 'pointsNumber', {
            min: 100,
            max: 30000,
            step: 100
        }).on('change', () => {
            this.createDotSphere()
        })

        folder.addBinding(this.panelParams, 'dotSize', {
            min: 0.002,
            max: 0.08,
            step: 0.001
        }).on('change', () => {
            this.createDotSphere()
        })
    }

    dispose() {
        this._dispose()
    }
}
