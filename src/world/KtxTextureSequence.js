import * as THREE from 'three/webgpu'
import { floor, texture, uniform, uv, vec2 } from 'three/tsl'
import { ATLAS_COLUMNS, ATLAS_ROWS, getAtlasFrameFromNormalizedX } from './sprite-atlas.js'

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
        this._onMouseMove = event => {
            const normalizedX = (event.clientX / window.innerWidth) * 2 - 1
            this.setFrame(getAtlasFrameFromNormalizedX(normalizedX))
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

    _build() {
        const keys = /** @type {const} */ ([
            'positionGridTex',
            'renderedGridTex',
            'motionVectorGridTex'
        ])

        const group = new THREE.Group()
        /** 预览平面宽高比 1:1（纹理仍为图集抽样） */
        const planeWidth = 2.5
        const planeHeight = planeWidth
        const gap = 0.35
        const halfRow = planeWidth + gap

        keys.forEach((key, index) => {
            const tex = this.experience.resources.items[key]
            if (!tex || !tex.isTexture) {
                console.warn(`[KtxTextureSequence] Missing texture "${key}", skip plane`)
                return
            }

            tex.needsUpdate = true

            const frameColumn = this._frameUniform.mod(ATLAS_COLUMNS)
            const frameRowFromTop = floor(this._frameUniform.div(ATLAS_COLUMNS))
            const atlasUv = uv().mul(vec2(1 / ATLAS_COLUMNS, 1 / ATLAS_ROWS)).add(
                vec2(
                    frameColumn.div(ATLAS_COLUMNS),
                    frameRowFromTop.mul(-1).add(ATLAS_ROWS - 1).div(ATLAS_ROWS)
                )
            )

            const material = new THREE.MeshBasicNodeMaterial()
            material.colorNode = texture(tex, atlasUv)
            material.transparent = true
            material.alphaTest = 0.01
            material.name = `${key}_preview`

            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight, 1, 1), material)
            const x = (index - 1) * halfRow
            mesh.position.set(x, 0, 0)

            group.add(mesh)
            this._disposables.push(mesh.geometry, material)
        })

        if (group.children.length > 0) {
            this.group = group
            this.scene.add(group)
        }
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
