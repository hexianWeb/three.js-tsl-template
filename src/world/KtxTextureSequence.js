import * as THREE from 'three/webgpu'
import { clamp, float, floor, min, mix, texture, uniform, uv, vec2 } from 'three/tsl'
import { getAtlasFrameProgressFromNormalizedX } from './sprite-atlas.js'
import { DEFAULT_PRESET, getPreset, RESOURCE_PRESETS } from '../config/resourcePresets.js'

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
        this._activePresetKey = DEFAULT_PRESET

        this._strengthUniform = uniform(0.003)
        this._opacityUniform = uniform(1.0)
        this._motionSignUniform = uniform(1.0)
        this._tileEpsilonUniform = uniform(0.0005)

        /** @type {Record<string, {
         *   group: THREE.Group,
         *   frameUniform: import('three/tsl').UniformNode,
         *   columns: number,
         *   rows: number,
         *   renderedKey: string,
         *   motionKey: string,
         *   positionKey: string,
         *   alphaKey?: string
         * }>} */
        this._presetEntries = {}

        this._onMouseMove = event => {
            const entry = this._presetEntries[this._activePresetKey]
            if (!entry) return

            const normalizedX = (event.clientX / window.innerWidth) * 2 - 1
            entry.frameUniform.value = getAtlasFrameProgressFromNormalizedX(
                normalizedX,
                entry.columns,
                entry.rows
            )
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
        const entry = this._presetEntries[this._activePresetKey]
        if (entry) {
            entry.frameUniform.value = frame
        }
    }

    /**
     * @param {import('three/tsl').Node} frameNode
     * @param {number} cols
     * @param {number} rows
     */
    _getAtlasTile(frameNode, cols, rows) {
        const frameColumn = frameNode.mod(cols)
        const frameRowFromTop = floor(frameNode.div(cols))
        const cellSize = vec2(1 / cols, 1 / rows)
        const tileOffset = vec2(
            frameColumn.div(cols),
            frameRowFromTop.mul(-1).add(rows - 1).div(rows)
        )
        const baseUv = uv()
        const atlasUv = baseUv.mul(cellSize).add(tileOffset)
        const tileMin = tileOffset
        const tileMax = tileOffset.add(cellSize)
        return { atlasUv, tileMin, tileMax, cellSize, baseUv }
    }

    /**
     * @param {THREE.Texture} colorTex
     * @param {THREE.Texture} motionTex
     * @param {import('three/tsl').Node} frameNode
     * @param {number} columns
     * @param {number} rows
     * @returns {import('three/tsl').Node}
     */
    _createSmoothFrameColorNode(colorTex, motionTex, frameNode, columns, rows) {
        const i1 = floor(frameNode)
        const frameCount = columns * rows
        const i2 = min(i1.add(float(1)), float(frameCount - 1))
        const blend = frameNode.fract()
    
        // 当前帧和下一帧 tile 信息
        const tile1 = this._getAtlasTile(i1, columns, rows)
        const tile2 = this._getAtlasTile(i2, columns, rows)
    
        const uv1 = tile1.atlasUv
        const uv2 = tile2.atlasUv
        const cellSize = tile1.cellSize
        const tileMin1 = tile1.tileMin
        const tileMax1 = tile1.tileMax
        const tileMin2 = tile2.tileMin
        const tileMax2 = tile2.tileMax
    
        // --- 双帧 Motion Vector ---
        const m1 = texture(motionTex, uv1).rg.mul(float(2)).sub(float(1)) // 当前帧
        const m2 = texture(motionTex, uv2).rg.mul(float(2)).sub(float(1)) // 下一帧
        const motionOffset1 = m1.mul(this._strengthUniform).mul(cellSize).mul(this._motionSignUniform)
        const motionOffset2 = m2.mul(this._strengthUniform).mul(cellSize).mul(this._motionSignUniform)
    
        // Warp UVs
        const sampleUv1 = uv1.sub(motionOffset1.mul(blend))
        const sampleUv2 = uv2.add(motionOffset2.mul(float(1).sub(blend)))
    
        // Clamp UVs 防止 bleeding
        const epsilon = this._tileEpsilonUniform
        const safeUv1 = clamp(sampleUv1, tileMin1.add(epsilon), tileMax1.sub(epsilon))
        const safeUv2 = clamp(sampleUv2, tileMin2.add(epsilon), tileMax2.sub(epsilon))
    
        // 采样颜色
        const col1 = texture(colorTex, safeUv1)
        const col2 = texture(colorTex, safeUv2)
    
        // 混合颜色
        return mix(col1, col2, blend)
    }

    /**
     * Alpha atlas: sample .r at unwarped tile UVs, then blend between frames.
     * @param {THREE.Texture} alphaTex
     * @param {import('three/tsl').Node} frameNode
     * @param {number} columns
     * @param {number} rows
     * @returns {import('three/tsl').Node}
     */
    _createSmoothFrameAlphaNode(alphaTex, frameNode, columns, rows) {
        const i1 = floor(frameNode)
        const frameCount = columns * rows
        const i2 = min(i1.add(float(1)), float(frameCount - 1))
        const blend = frameNode.fract()

        const uv1 = this._getAtlasTile(i1, columns, rows).atlasUv
        const uv2 = this._getAtlasTile(i2, columns, rows).atlasUv

        const alpha1 = texture(alphaTex, uv1).r
        const alpha2 = texture(alphaTex, uv2).r

        return mix(alpha1, alpha2, blend)
    }

    /**
     * @param {string} presetKey
     * @param {ReturnType<typeof getPreset>} preset
     */
    _buildPresetGroup(presetKey, preset) {
        const { columns, rows, rendered: renderedKey, motion: motionKey, position: positionKey, alpha: alphaKey } = preset
        const renderedTex = this.experience.resources.items[renderedKey]
        const motionTex = this.experience.resources.items[motionKey]
        const positionTex = positionKey ? this.experience.resources.items[positionKey] : null
        const alphaTex = alphaKey ? this.experience.resources.items[alphaKey] : null

        const group = new THREE.Group()
        group.name = `preset_${presetKey}`
        group.visible = presetKey === this._activePresetKey

        const frameUniform = uniform(0)

        if (renderedTex) {
            renderedTex.colorSpace = THREE.SRGBColorSpace
            renderedTex.needsUpdate = true
        }
        if (motionTex) {
            motionTex.colorSpace = THREE.LinearSRGBColorSpace
            motionTex.needsUpdate = true
        }
        if (positionTex) {
            positionTex.colorSpace = THREE.LinearSRGBColorSpace
            positionTex.needsUpdate = true
        }
        if (alphaTex) {
            alphaTex.colorSpace = THREE.LinearSRGBColorSpace
            alphaTex.needsUpdate = true
        }

        const mainWidth = 3.0
        const mainHeight = mainWidth

        if (renderedTex && motionTex) {
            const mainMaterial = new THREE.MeshBasicNodeMaterial()
            mainMaterial.colorNode = this._createSmoothFrameColorNode(
                renderedTex,
                motionTex,
                frameUniform,
                columns,
                rows
            )
            mainMaterial.transparent = true
            mainMaterial.alphaTest = 0.01
            mainMaterial.opacityNode = alphaTex
                ? this._createSmoothFrameAlphaNode(alphaTex, frameUniform, columns, rows).mul(this._opacityUniform)
                : this._opacityUniform
            mainMaterial.name = `${presetKey}_main`

            const mainMesh = new THREE.Mesh(new THREE.PlaneGeometry(mainWidth, mainHeight, 1, 1), mainMaterial)
            mainMesh.position.set(0, 1.2, 0)
            group.add(mainMesh)
            this._disposables.push(mainMesh.geometry, mainMaterial)
        }

        const previewScale = 0.45
        const previewWidth = 2.5 * previewScale
        const previewHeight = previewWidth
        const gap = 0.2
        const halfRow = previewWidth + gap
        const previewY = -1.8

        const previewKeys = [positionKey, renderedKey, alphaKey, motionKey].filter(Boolean)
        for (const [index, key] of previewKeys.entries()) {
            const tex = this.experience.resources.items[key]
            if (!tex?.isTexture) {
                console.warn(`[KtxTextureSequence] Missing texture "${key}", skip plane`)
                continue
            }

            tex.needsUpdate = true

            const { atlasUv } = this._getAtlasTile(frameUniform, columns, rows)

            const material = new THREE.MeshBasicNodeMaterial()
            material.colorNode = texture(tex, atlasUv)
            material.transparent = true
            material.alphaTest = 0.01
            material.name = `${presetKey}_${key}_preview`

            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(previewWidth, previewHeight, 1, 1), material)
            const xIndex = previewKeys.length === 1 ? 0 : index - (previewKeys.length - 1) / 2
            mesh.position.set(xIndex * halfRow, previewY, 0)
            group.add(mesh)
            this._disposables.push(mesh.geometry, material)
        }

        return {
            group,
            frameUniform,
            columns,
            rows,
            renderedKey,
            motionKey,
            positionKey,
            alphaKey
        }
    }

    _build() {
        const rootGroup = new THREE.Group()

        for (const [presetKey, preset] of Object.entries(RESOURCE_PRESETS)) {
            const entry = this._buildPresetGroup(presetKey, preset)
            if (entry.group.children.length === 0) continue

            this._presetEntries[presetKey] = entry
            rootGroup.add(entry.group)
        }

        if (rootGroup.children.length > 0) {
            this.group = rootGroup
            this.scene.add(rootGroup)
        }
    }

    /**
     * @param {string} presetKey
     */
    _setActivePreset(presetKey) {
        if (!this._presetEntries[presetKey]) return

        this._activePresetKey = presetKey

        for (const [key, entry] of Object.entries(this._presetEntries)) {
            entry.group.visible = key === presetKey
        }
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        const folder = debug.addFolder({ title: 'Motion Vector Sequence' })
        if (!folder) return

        const presetOptions = {}
        for (const [key, preset] of Object.entries(RESOURCE_PRESETS)) {
            presetOptions[preset.label] = key
        }

        folder.addBinding(this, '_activePresetKey', {
            options: presetOptions,
            label: 'Resource Set'
        }).on('change', ev => {
            this._setActivePreset(ev.value)
        })

        folder.addBinding(this._strengthUniform, 'value', { min: 0, max: 0.10, step: 0.001, label: 'strength' })
        folder.addBinding(this._opacityUniform, 'value', { min: 0, max: 1, step: 0.01, label: 'opacity' })
        folder.addBinding(this._motionSignUniform, 'value', { min: -1, max: 1, step: 2, label: 'motion sign (1/-1)' })
        folder.addBinding(this._tileEpsilonUniform, 'value', { min: 0, max: 0.01, step: 0.0001, label: 'tile epsilon' })

        const getActiveRenderedTex = () => {
            const entry = this._presetEntries[this._activePresetKey]
            return entry ? this.experience.resources.items[entry.renderedKey] : null
        }

        const csOptions = { SRGB: THREE.SRGBColorSpace, Linear: THREE.LinearSRGBColorSpace }
        folder.addBinding({ colorSpace: THREE.SRGBColorSpace }, 'colorSpace', {
            options: csOptions,
            label: 'rendered colorSpace'
        }).on('change', ev => {
            const tex = getActiveRenderedTex()
            if (tex) {
                tex.colorSpace = ev.value
                tex.needsUpdate = true
            }
        })

        folder.addButton({ title: 'Reset motion/pos/alpha to LinearSRGB' }).on('click', () => {
            const entry = this._presetEntries[this._activePresetKey]
            if (!entry) return

            for (const key of [entry.motionKey, entry.positionKey, entry.alphaKey].filter(Boolean)) {
                const tex = this.experience.resources.items[key]
                if (tex) {
                    tex.colorSpace = THREE.LinearSRGBColorSpace
                    tex.needsUpdate = true
                }
            }
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
