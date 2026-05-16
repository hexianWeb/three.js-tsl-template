import * as THREE from 'three/webgpu'
import { getAtlasFrameFromNormalizedX, getAtlasUvTransform } from './sprite-atlas.js'

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        /** @type {THREE.Group | null} */
        this.ktxDemoGroup = null
        this._disposeKtxDemo = []
        this._atlasTextures = []
        this._currentFrame = -1
        this._onMouseMove = event => {
            const normalizedX = (event.clientX / window.innerWidth) * 2 - 1
            this._setAtlasFrame(getAtlasFrameFromNormalizedX(normalizedX))
        }

        window.addEventListener('mousemove', this._onMouseMove)

        experience.resources.ready.then(() => {
            this._buildKtxTexturePlanes(experience)
            this._setAtlasFrame(getAtlasFrameFromNormalizedX(0))
        })
    }

    /**
     * @param {number} frame
     */
    _setAtlasFrame(frame) {
        if (frame === this._currentFrame) {
            return
        }

        this._currentFrame = frame
        const transform = getAtlasUvTransform(frame)

        for (const tex of this._atlasTextures) {
            tex.repeat.set(transform.repeatX, transform.repeatY)
            tex.offset.set(transform.offsetX, transform.offsetY)
            tex.needsUpdate = true
        }
    }

    /**
     * @param {import('../app/Experience.js').default} experience
     */
    _buildKtxTexturePlanes(experience) {
        const keys = /** @type {const} */ ([
            'positionGridTex',
            'renderedGridTex',
            'motionVectorGridTex'
        ])

        const group = new THREE.Group()
        /** 纹理 宽:高 = 5:7 */
        const planeWidth = 2.5
        const planeHeight = (planeWidth * 7) / 5
        const gap = 0.35
        const halfRow = planeWidth + gap

        keys.forEach((key, index) => {
            const tex = experience.resources.items[key]
            if (!tex || !tex.isTexture) {
                console.warn(`[World] Missing texture "${key}", skip plane`)
                return
            }

            tex.needsUpdate = true
            tex.repeat.set(1 / 5, 1 / 7)
            tex.offset.set(0, 6 / 7)
            this._atlasTextures.push(tex)

            const material = new THREE.MeshBasicMaterial({ map: tex })
            material.name = `${key}_preview`
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight, 1, 1), material)
            const x = (index - 1) * halfRow
            mesh.position.set(x, 0, 0)

            group.add(mesh)
            this._disposeKtxDemo.push(mesh.geometry, material)
        })

        if (group.children.length > 0) {
            this.ktxDemoGroup = group
            this.scene.add(group)
        }
    }

    /**
     * @param {import('../utils/debug.js').default} _debug
     */
    debuggerInit(_debug) {}

    update() {}

    dispose() {
        for (const disposable of this._disposeKtxDemo) {
            if (disposable && typeof disposable.dispose === 'function') {
                disposable.dispose()
            }
        }
        this._disposeKtxDemo = []

        if (this.ktxDemoGroup) {
            this.scene.remove(this.ktxDemoGroup)
            this.ktxDemoGroup = null
        }

        window.removeEventListener('mousemove', this._onMouseMove)
    }
}
