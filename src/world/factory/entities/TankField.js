import * as THREE from 'three/webgpu'
import { FACTORY_CONFIG, FLYBAR_TANK_Y } from '../config.js'
import { createTankMaterial } from '../materials/createTankMaterial.js'

export default class TankField {
    /**
     * @param {THREE.Object3D} boxScene box.glb 的 scene
     * @param {Array<{ id: number, x: number, z: number }>} tankStates
     */
    constructor(boxScene, tankStates) {
        this.root = new THREE.Group()
        this.root.name = 'TankField'

        const sourceMesh = findFirstMesh(boxScene)
        if (!sourceMesh) {
            throw new Error('[TankField] box.glb contains no mesh')
        }
        const geometry = sourceMesh.geometry.clone()
        const sourceMaterial = Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material
        const baseMap = sourceMaterial?.map ?? null

        const count = tankStates.length
        const aRough = new Float32Array(count)
        const aMetal = new Float32Array(count)
        const { baseRoughness, baseMetalness, jitter } = FACTORY_CONFIG.tanks
        for (let i = 0; i < count; i++) {
            aRough[i] = clamp01(baseRoughness + (Math.random() * 2 - 1) * jitter)
            aMetal[i] = clamp01(baseMetalness + (Math.random() * 2 - 1) * jitter)
        }
        geometry.setAttribute('aRough', new THREE.InstancedBufferAttribute(aRough, 1))
        geometry.setAttribute('aMetal', new THREE.InstancedBufferAttribute(aMetal, 1))

        const material = createTankMaterial(baseMap)

        const mesh = new THREE.InstancedMesh(geometry, material, count)
        mesh.castShadow = true
        mesh.receiveShadow = true

        const dummy = new THREE.Object3D()
        this.anchors = []
        for (let i = 0; i < count; i++) {
            const t = tankStates[i]
            dummy.position.set(t.x, 0, t.z)
            dummy.rotation.set(0, 0, 0)
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)

            const anchor = new THREE.Object3D()
            anchor.position.set(t.x, FLYBAR_TANK_Y, t.z)
            this.root.add(anchor)
            this.anchors.push(anchor)
        }
        mesh.instanceMatrix.needsUpdate = true

        this.root.add(mesh)
        this.mesh = mesh
        this.material = material
        this.geometry = geometry
    }

    /** @param {number} tankId */
    getAnchor(tankId) {
        return this.anchors[tankId]
    }

    update() {}

    dispose() {
        this.geometry?.dispose()
        this.material?.dispose()
        this.root.parent?.remove(this.root)
    }
}

function findFirstMesh(root) {
    let found = null
    root.traverse((c) => {
        if (!found && c.isMesh) found = c
    })
    return found
}

function clamp01(v) {
    return Math.max(0, Math.min(1, v))
}
