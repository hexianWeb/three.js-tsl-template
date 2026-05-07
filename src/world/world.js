import * as THREE from 'three/webgpu'
import { eventBus } from '../utils/event-bus.js'
import Factory from './factory/Factory.js'

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        /** @type {Factory | null} */
        this.factory = null
        /** @type {THREE.Object3D | null} */
        this.model = null

        this.scene.add(new THREE.AxesHelper(100))
        eventBus.on('source ready', () => {
            const items = this.experience.resources?.items
            const craneScene = items?.craneModel?.scene
            const flybarScene = items?.flybarModel?.scene
            const tankBoxScene = items?.tankBoxModel?.scene
            const railwayScene = items?.railwayModel?.scene

            if (!craneScene || !flybarScene || !tankBoxScene || !railwayScene) {
                const detail = {
                    crane: !!craneScene,
                    flybar: !!flybarScene,
                    tank: !!tankBoxScene,
                    railway: !!railwayScene
                }
                console.error('[World] missing required factory glbs', detail)
                throw new Error('[World] missing required factory glbs')
            }

            this.factory = new Factory({ craneScene, flybarScene, tankBoxScene, railwayScene })
            this.scene.add(this.factory.root)

            this.model = this.factory.root
            this._frameCameraToFactory()
        })
    }

    _frameCameraToFactory() {
        if (!this.factory) return
        const camera = this.experience.worldCamera.instance
        const controls = this.experience.worldCamera.controls

        const box = new THREE.Box3().setFromObject(this.factory.root)
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

    /** @param {number} dt seconds */
    update(dt) {
        this.factory?.update(dt ?? 0)
    }

    dispose() {
        this.factory?.dispose()
        this.factory = null
        this.model = null
    }
}
