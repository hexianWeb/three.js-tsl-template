import * as THREE from 'three/webgpu'
import { eventBus } from '../utils/event-bus.js'

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        /** @type {THREE.Object3D | null} */
        this.model = null

        this.scene.add(new THREE.AxesHelper(100))
        eventBus.on('source ready', () => {
            const gltf = this.experience.resources?.items?.craneModel
            if (!gltf?.scene) {
                return
            }

            this.model = gltf.scene
            this._prepareMeshes(this.model)
            this.scene.add(this.model)
            this._frameCameraToModel(this.model)
        })
    }

    /**
     * @description 准备模型材质
     * @param {THREE.Object3D} root
     */
    _prepareMeshes(root) {
        root.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return
            child.castShadow = true
            child.receiveShadow = true

            const materials = Array.isArray(child.material) ? child.material : [child.material]
            const prepared = materials.map((material) => {
                if (!material || material.isMeshStandardMaterial) {
                    return material
                }

                const fallback = new THREE.MeshPhysicalMaterial({
                    color: material.color ?? 0xcccccc,
                    map: material.map ?? null
                })
                material.dispose?.()
                return fallback
            })

            child.material = Array.isArray(child.material) ? prepared : prepared[0]
        })
    }

    /**
     * @description 将相机定位到模型中心
     * @param {THREE.Object3D} object
     */
    _frameCameraToModel(object) {
        const camera = this.experience.worldCamera.instance
        const controls = this.experience.worldCamera.controls

        const box = new THREE.Box3().setFromObject(object)
        if (box.isEmpty()) {
            return
        }

        const center = box.getCenter(new THREE.Vector3())
        const sphere = box.getBoundingSphere(new THREE.Sphere())

        const padding = 1.35
        const fovRad = THREE.MathUtils.degToRad(camera.fov)
        const distance = (sphere.radius / Math.sin(fovRad / 2)) * padding

        const offset = new THREE.Vector3(1, 0.55, 1).normalize().multiplyScalar(distance)
        camera.position.copy(center).add(offset)
        camera.near = Math.max(0.01, sphere.radius / 100)
        camera.far = Math.max(500, sphere.radius * 50)
        camera.updateProjectionMatrix()

        controls.target.copy(center)
        controls.maxDistance = Math.max(sphere.radius * 20, distance * 4)
        controls.update()
    }

    update() {}

    dispose() {
        if (!this.model) {
            return
        }

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose()
                const mats = Array.isArray(child.material) ? child.material : [child.material]
                for (const m of mats) {
                    m?.dispose?.()
                }
            }
        })
        this.scene.remove(this.model)
        this.model = null
    }
}
