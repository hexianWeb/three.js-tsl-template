import * as THREE from 'three/webgpu'
import { eventBus } from '../utils/event-bus.js'
import Factory from './factory/Factory.js'
import FactoryFloor from './FactoryFloor.js'
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
        this.factoryFloor = new FactoryFloor(this.scene, this.experience)

        this.scene.add(new THREE.AxesHelper(100))
        eventBus.on('source ready', () => {
            const items = this.experience.resources?.items
            const craneScene = items?.craneModel?.scene
            const flybarScene = items?.flybarModel?.scene
            const tankBoxScene = items?.tankBoxModel?.scene
            const railwayScene = items?.railwayModel?.scene
            const wallColumnScene = items?.wallColumnModel?.scene

            if (!craneScene || !flybarScene || !tankBoxScene || !railwayScene || !wallColumnScene) {
                const detail = {
                    crane: !!craneScene,
                    flybar: !!flybarScene,
                    tank: !!tankBoxScene,
                    railway: !!railwayScene,
                    wallColumn: !!wallColumnScene
                }
                console.error('[World] missing required factory glbs', detail)
                throw new Error('[World] missing required factory glbs')
            }

            this.factory = new Factory({ craneScene, flybarScene, tankBoxScene, railwayScene })
            this.scene.add(this.factory.root)
            this.factoryFloor.addToScene()

            if (this.experience.debug.active) {
                this.factory.debuggerInit(this.experience.debug)
            }

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

        const padding = 0.5
        const fovRad = THREE.MathUtils.degToRad(camera.fov)
        const distance = (sphere.radius / Math.sin(fovRad / 2)) * padding

        const offset = new THREE.Vector3(0, 0.5, 1).normalize().multiplyScalar(distance)
        camera.position.copy(center).add(offset)
        camera.near = Math.max(0.01, sphere.radius / 100)
        camera.far = Math.max(500, sphere.radius * 50)
        camera.updateProjectionMatrix()

        controls.target.copy(center)
        controls.maxDistance = Math.max(sphere.radius * 20, distance * 4)
        controls.update()
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        this.factoryFloor.debuggerInit(debug)
    }

    /** @param {number} dt seconds */
    update(dt) {
        this.factory?.update(dt ?? 0)
    }

    dispose() {
        this.factoryFloor.dispose()
        this.factory?.dispose()
        this.factory = null
        this.model = null
    }
}
