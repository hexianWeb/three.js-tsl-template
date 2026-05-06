import * as THREE from 'three/webgpu'
import {
    pass,
    mrt,
    output,
    diffuseColor,
    normalView,
    velocity,
    directionToColor,
    colorToDirection,
    sample,
    add,
    vec4
} from 'three/tsl'
import { ssgi } from 'three/addons/tsl/display/SSGINode.js'

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
        this.giPass = null
        this.compositeNode = null
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
        const scenePassDiffuse = scenePass.getTextureNode('diffuseColor')
        const scenePassDepth = scenePass.getTextureNode('depth')
        const scenePassNormal = scenePass.getTextureNode('normal')

        const sceneNormal = sample((uv) => {
            return colorToDirection(scenePassNormal.sample(uv))
        })

        const giPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera)
        giPass.sliceCount.value = 2
        giPass.stepCount.value = 12

        const gi = giPass.rgb
        const ao = giPass.a

        const compositeNode = vec4(
            add(scenePassColor.rgb.mul(ao), scenePassDiffuse.rgb.mul(gi)),
            scenePassColor.a
        )

        this.scenePass = scenePass
        this.giPass = giPass
        this.compositeNode = compositeNode
        this.renderPipeline = new THREE.RenderPipeline(this.instance, compositeNode)
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
