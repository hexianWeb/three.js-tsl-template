import * as THREE from 'three/webgpu'
import { sin, positionLocal, time, vec2, vec3, vec4, uv, uniform, color, float } from 'three/tsl'

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        this.tweakParams = {
            timeFrequency: 0.5,
            positionFrequency: 2,
            intensityFrequency: 0.5
        }

        this.createIcosahedron()
    }

    createIcosahedron() {
        const geometry = new THREE.IcosahedronGeometry(1, 0)
        const material = new THREE.MeshPhysicalNodeMaterial()

        material.colorNode = color(0xffffff)
        material.roughnessNode = float(0.1)
        material.metalnessNode = float(1.0)

        this.mesh = new THREE.Mesh(geometry, material)
        this.scene.add(this.mesh)
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {

    }

    update() {}

    dispose() {

    }
}
