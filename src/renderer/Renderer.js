import * as THREE from 'three/webgpu'
import {
    pass,
    mrt,
    output,
    diffuseColor,
    normalView,
    velocity,
    directionToColor
} from 'three/tsl'

export default class Renderer {
    /**
     * @param {{ canvas: HTMLCanvasElement }} options
     */
    constructor({ canvas }) {
        this.instance = new THREE.WebGPURenderer({
            canvas,
            forceWebGL: false
        })

        this.instance.toneMapping = THREE.ACESFilmicToneMapping
        this.instance.toneMappingExposure = 1.0
        this.instance.shadowMap.enabled = true

        /** @type {THREE.RenderPipeline | null} */
        this.renderPipeline = null
        /** @type {ReturnType<typeof pass> | null} */
        this.scenePass = null
    }

    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     */
    attachPipeline(scene, camera) {
        const scenePass = pass(scene, camera)
        scenePass.setMRT(
            mrt({
                output: output,
                diffuseColor: diffuseColor,
                normal: directionToColor(normalView),
                velocity: velocity
            })
        )

        const diffuseTexture = scenePass.getTexture('diffuseColor')
        diffuseTexture.type = THREE.UnsignedByteType
        const normalTexture = scenePass.getTexture('normal')
        normalTexture.type = THREE.UnsignedByteType

        const scenePassColor = scenePass.getTextureNode('output')

        this.scenePass = scenePass
        this.renderPipeline = new THREE.RenderPipeline(this.instance, scenePassColor)
    }

    async init() {
        await this.instance.init()
    }

    /**
     * @param {{ width: number, height: number }} sizes
     */
    setSizeFromSizes(sizes) {
        this.instance.setSize(sizes.width, sizes.height)
        this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 1))
    }

    render() {
        this.renderPipeline.render()
    }
}
