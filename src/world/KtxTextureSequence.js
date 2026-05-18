import * as THREE from 'three/webgpu'
import { clamp, float, floor, min, mix, texture, uniform, uv, vec2 } from 'three/tsl'
import { ATLAS_COLUMNS, ATLAS_ROWS, ATLAS_FRAME_COUNT, getAtlasFrameFromNormalizedX, getAtlasFrameProgressFromNormalizedX } from './sprite-atlas.js'

export default class KtxTextureSequence {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        /** @type {THREE.Group | null} */
        this.group = null
        this._disposables = []
        this._frameUniform = uniform(getAtlasFrameFromNormalizedX(0))
        this._strengthUniform = uniform(0.01)
        this._opacityUniform = uniform(1.0)
        this._motionSignUniform = uniform(1.0)
        this._tileEpsilonUniform = uniform(0.0005)
        this._onMouseMove = event => {
            const normalizedX = (event.clientX / window.innerWidth) * 2 - 1
            this.setFrame(getAtlasFrameProgressFromNormalizedX(normalizedX))
        }

        window.addEventListener('mousemove', this._onMouseMove)

        experience.resources.ready.then(() => {
            this._build()
        })
    }

    /**
     * @param {number} frame
     */
    setFrame(frame) {
        this._frameUniform.value = frame
    }

    /**
     * Compute atlas tile info for a given frame node.
     * Distinguishes base UV, tile offset, min/max for clamping, cell size.
     * @param {import('three/tsl').Node} frameNode
     */
    _getAtlasTile(frameNode) {
        const frameColumn = frameNode.mod(ATLAS_COLUMNS)
        const frameRowFromTop = floor(frameNode.div(ATLAS_COLUMNS))
        const cellSize = vec2(1 / ATLAS_COLUMNS, 1 / ATLAS_ROWS)
        const tileOffset = vec2(
            frameColumn.div(ATLAS_COLUMNS),
            frameRowFromTop.mul(-1).add(ATLAS_ROWS - 1).div(ATLAS_ROWS)
        )
        const baseUv = uv()
        const atlasUv = baseUv.mul(cellSize).add(tileOffset)
        const tileMin = tileOffset
        const tileMax = tileOffset.add(cellSize)
        return { atlasUv, tileMin, tileMax, cellSize, baseUv }
    }

    /**
     * Create TSL node for smooth interpolated frame using motion vector.
     * Uses single-direction (m1) compensation, cell-space offset, tile clamp.
     * @param {THREE.Texture} colorTex
     * @param {THREE.Texture} motionTex
     * @returns {import('three/tsl').Node}
     */
    _createSmoothFrameColorNode(colorTex, motionTex) {
        const frame = this._frameUniform
        const i1 = floor(frame)
        const i2 = min(i1.add(float(1)), float(ATLAS_FRAME_COUNT - 1))
        const blend = frame.fract()

        const tile1 = this._getAtlasTile(i1)
        const tile2 = this._getAtlasTile(i2)

        const uv1 = tile1.atlasUv
        const uv2 = tile2.atlasUv
        const cellSize = tile1.cellSize
        const tileMin1 = tile1.tileMin
        const tileMax1 = tile1.tileMax
        const tileMin2 = tile2.tileMin
        const tileMax2 = tile2.tileMax

        const m1 = texture(motionTex, uv1).rg.mul(float(2)).sub(float(1))
        const motionOffset = m1.mul(this._strengthUniform).mul(cellSize).mul(this._motionSignUniform)

        const sampleUv1 = uv1.sub(motionOffset.mul(blend))
        const sampleUv2 = uv2.add(motionOffset.mul(float(1).sub(blend)))

        const epsilon = this._tileEpsilonUniform
        const safeUv1 = clamp(sampleUv1, tileMin1.add(epsilon), tileMax1.sub(epsilon))
        const safeUv2 = clamp(sampleUv2, tileMin2.add(epsilon), tileMax2.sub(epsilon))

        const col1 = texture(colorTex, safeUv1)
        const col2 = texture(colorTex, safeUv2)

        const blended = mix(col1, col2, blend)

        return blended
    }

    _build() {
        const keys = /** @type {const} */ ([
            'positionGridTex',
            'renderedGridTex',
            'motionVectorGridTex'
        ])

        const group = new THREE.Group()

        // Set default colorSpaces per plan: motion/position = NoColorSpace, rendered configurable
        const renderedTex = this.experience.resources.items.renderedGridTex
        const motionTex = this.experience.resources.items.motionVectorGridTex
        const positionTex = this.experience.resources.items.positionGridTex
        if (renderedTex) {
            renderedTex.colorSpace = THREE.SRGBColorSpace
            renderedTex.needsUpdate = true
        }
        if (motionTex) {
            motionTex.colorSpace = THREE.NoColorSpace
            motionTex.needsUpdate = true
        }
        if (positionTex) {
            positionTex.colorSpace = THREE.NoColorSpace
            positionTex.needsUpdate = true
        }

        // Main effect plane (centered, uses smooth motion-vector interpolation)
        const mainWidth = 3.0
        const mainHeight = mainWidth
        if (renderedTex && motionTex) {
            const mainMaterial = new THREE.MeshBasicNodeMaterial()
            mainMaterial.colorNode = this._createSmoothFrameColorNode(renderedTex, motionTex)
            mainMaterial.transparent = true
            mainMaterial.alphaTest = 0.01
            mainMaterial.opacityNode = this._opacityUniform
            mainMaterial.name = 'main_interpolated'
            const mainMesh = new THREE.Mesh(new THREE.PlaneGeometry(mainWidth, mainHeight, 1, 1), mainMaterial)
            mainMesh.position.set(0, 1.2, 0)
            group.add(mainMesh)
            this._disposables.push(mainMesh.geometry, mainMaterial)
        }

        // Debug preview planes (smaller, below main)
        const previewScale = 0.45
        const previewWidth = 2.5 * previewScale
        const previewHeight = previewWidth
        const gap = 0.2
        const halfRow = previewWidth + gap
        const previewY = -1.8

        keys.forEach((key, index) => {
            const tex = this.experience.resources.items[key]
            if (!tex || !tex.isTexture) {
                console.warn(`[KtxTextureSequence] Missing texture "${key}", skip plane`)
                return
            }

            tex.needsUpdate = true

            const { atlasUv } = this._getAtlasTile(this._frameUniform)

            const material = new THREE.MeshBasicNodeMaterial()
            material.colorNode = texture(tex, atlasUv)
            material.transparent = true
            material.alphaTest = 0.01
            material.name = `${key}_preview`

            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(previewWidth, previewHeight, 1, 1), material)
            const x = (index - 1) * halfRow
            mesh.position.set(x, previewY, 0)

            group.add(mesh)
            this._disposables.push(mesh.geometry, material)
        })

        if (group.children.length > 0) {
            this.group = group
            this.scene.add(group)
        }
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        const folder = debug.addFolder({ title: 'Motion Vector Sequence' })
        if (!folder) return

        folder.addBinding(this._strengthUniform, 'value', { min: 0, max: 0.2, step: 0.001, label: 'strength' })
        folder.addBinding(this._opacityUniform, 'value', { min: 0, max: 1, step: 0.01, label: 'opacity' })
        folder.addBinding(this._motionSignUniform, 'value', { min: -1, max: 1, step: 2, label: 'motion sign (1/-1)' })
        folder.addBinding(this._tileEpsilonUniform, 'value', { min: 0, max: 0.01, step: 0.0001, label: 'tile epsilon' })

        // ColorSpace controls for rendered (others locked to NoColorSpace)
        const renderedTex = this.experience.resources.items.renderedGridTex
        const motionTex = this.experience.resources.items.motionVectorGridTex
        const positionTex = this.experience.resources.items.positionGridTex

        const csOptions = { SRGB: THREE.SRGBColorSpace, Linear: THREE.NoColorSpace }
        folder.addBinding(renderedTex || {}, 'colorSpace', { options: csOptions, label: 'rendered colorSpace' })
            .on('change', () => { if (renderedTex) renderedTex.needsUpdate = true })

        // Quick reset for motion/position to NoColorSpace
        folder.addButton({ title: 'Reset motion/pos to NoColorSpace' }).on('click', () => {
            if (motionTex) { motionTex.colorSpace = THREE.NoColorSpace; motionTex.needsUpdate = true }
            if (positionTex) { positionTex.colorSpace = THREE.NoColorSpace; positionTex.needsUpdate = true }
        })
    }

    update() {}

    dispose() {
        for (const disposable of this._disposables) {
            if (disposable && typeof disposable.dispose === 'function') {
                disposable.dispose()
            }
        }
        this._disposables = []

        if (this.group) {
            this.scene.remove(this.group)
            this.group = null
        }

        window.removeEventListener('mousemove', this._onMouseMove)
    }
}
