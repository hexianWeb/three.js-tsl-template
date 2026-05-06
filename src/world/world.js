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

        /** @type {THREE.Box3Helper | null} */
        this._modelBoundsHelper = null

        eventBus.on('source ready', () => {
            const gltf = this.experience.resources?.items?.craneModel
            if (!gltf?.scene) {
                return
            }

            this.model = gltf.scene
            this.scene.add(this.model)
            this._debugModelBoundingBox(this.model)
            this._frameCameraToModel(this.model)
        })
    }

    /**
     * Dev-only: log AABB and draw {@link THREE.Box3Helper} around the loaded GLB.
     * @param {THREE.Object3D} object
     */
    _debugModelBoundingBox(object) {
        if (!import.meta.env.DEV) {
            return
        }

        const box = new THREE.Box3().setFromObject(object)
        if (box.isEmpty()) {
            console.warn('[World] GLB bounding box is empty')
            return
        }

        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        console.log('[World] GLB AABB', {
            min: box.min.toArray(),
            max: box.max.toArray(),
            size: size.toArray(),
            center: center.toArray(),
        })

        if (this._modelBoundsHelper) {
            this.scene.remove(this._modelBoundsHelper)
            this._modelBoundsHelper.geometry.dispose()
            this._modelBoundsHelper.material.dispose()
            this._modelBoundsHelper = null
        }

        this._modelBoundsHelper = new THREE.Box3Helper(box, 0xffaa33)
        this.scene.add(this._modelBoundsHelper)
    }

    /**
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
        if (this._modelBoundsHelper) {
            this.scene.remove(this._modelBoundsHelper)
            this._modelBoundsHelper.geometry.dispose()
            this._modelBoundsHelper.material.dispose()
            this._modelBoundsHelper = null
        }

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
