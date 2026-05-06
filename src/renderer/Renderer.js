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
    vec3,
    vec4
} from 'three/tsl'
import { ssgi } from 'three/addons/tsl/display/SSGINode.js'
import { traa } from 'three/addons/tsl/display/TRAANode.js'

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
        this.traaPass = null
        this.scenePassColor = null
        this.gi = null
        this.ao = null
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
        const scenePassVelocity = scenePass.getTextureNode('velocity')

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

        const traaPass = traa(compositeNode, scenePassDepth, scenePassVelocity, camera)

        this.scenePass = scenePass
        this.giPass = giPass
        this.compositeNode = compositeNode
        this.traaPass = traaPass
        this.scenePassColor = scenePassColor
        this.gi = gi
        this.ao = ao
        this.renderPipeline = new THREE.RenderPipeline(this.instance, traaPass)
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

    /**
     * @param {'combined'|'ao'|'gi'|'direct'} mode
     */
    setOutputMode(mode) {
        if (!this.renderPipeline) return
        switch (mode) {
            case 'ao':
                this.renderPipeline.outputNode = vec4(vec3(this.ao), 1)
                break
            case 'gi':
                this.renderPipeline.outputNode = vec4(this.gi, 1)
                break
            case 'direct':
                this.renderPipeline.outputNode = this.scenePassColor
                break
            case 'combined':
            default:
                this.renderPipeline.outputNode = this.traaPass
                break
        }
        this.renderPipeline.needsUpdate = true
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active || !this.giPass) return
        const folder = debug.addFolder({ title: 'Postprocess', expanded: false })
        if (!folder) return

        const state = { mode: 'combined' }
        folder
            .addBinding(state, 'mode', {
                label: 'Output',
                options: { Combined: 'combined', AO: 'ao', GI: 'gi', Direct: 'direct' }
            })
            .on('change', (ev) => this.setOutputMode(ev.value))

        const ssgi = folder.addFolder({ title: 'SSGI', expanded: true })
        ssgi.addBinding(this.giPass.sliceCount, 'value', { min: 1, max: 4, step: 1, label: 'sliceCount' })
        ssgi.addBinding(this.giPass.stepCount, 'value', { min: 1, max: 32, step: 1, label: 'stepCount' })
        ssgi.addBinding(this.giPass.radius, 'value', { min: 1, max: 25, label: 'radius' })
        ssgi.addBinding(this.giPass.thickness, 'value', { min: 0.01, max: 10, label: 'thickness' })
        ssgi.addBinding(this.giPass.aoIntensity, 'value', { min: 0, max: 4, label: 'aoIntensity' })
        ssgi.addBinding(this.giPass.giIntensity, 'value', { min: 0, max: 100, label: 'giIntensity' })
    }
}
