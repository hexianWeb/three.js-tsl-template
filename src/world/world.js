import * as THREE from 'three/webgpu'
import { eventBus } from '../utils/event-bus.js'
import Factory from './factory/Factory.js'
import { TANK_MAX_X } from './factory/config.js'
import { ROW_GAP_Z } from './factory/layout.js'
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
        /** @type {THREE.Mesh | null} */
        this.ground = null
        /** 承重柱（地板地形）；与 ground 同层，不参与 factory.root 取景。 */
        /** @type {THREE.Object3D | null} */
        this.bearingColumn = null
        /** @type {import('../utils/debug.js').default | null} */
        this._debug = null
        /** @type {boolean} */
        this._groundDebugBound = false

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
            this._addGroundPlane()

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
     * 铺在车间下方的大地板；挂在 scene 上而非 factory.root，避免参与取景包围盒把相机拉得过远。
     */
    _addGroundPlane() {
        if (!this.ground) {
            const geometry = new THREE.PlaneGeometry(2000, 2000)
            geometry.rotateX(-Math.PI / 2)
            const material = new THREE.MeshStandardMaterial({
                color: '#071726',
                roughness: 0.92,
                metalness: 0.06
            })
            const mesh = new THREE.Mesh(geometry, material)
            mesh.name = 'FactoryGround'
            mesh.position.set(TANK_MAX_X / 2, -18 * 1.5,  0)
            mesh.receiveShadow = true
            this.ground = mesh
            this.scene.add(mesh)
        }

        const wall1Scene = this.experience.resources?.items?.wallColumnModel?.scene.clone(true)
        const wall2Scene = this.experience.resources?.items?.wallColumnModel?.scene.clone(true)
        if (wall1Scene && wall2Scene && !this.bearingColumn1 && !this.bearingColumn2) {
            wall1Scene.name = 'BearingColumn'
            wall1Scene.position.set(0, 0, 0 - ROW_GAP_Z / 2)
            wall2Scene.name = 'BearingColumn'
            wall2Scene.position.set(0, 0, 0 + ROW_GAP_Z / 2)
            this.scene.add(wall1Scene)
            this.scene.add(wall2Scene)
            this.bearingColumn1 = wall1Scene
            this.bearingColumn2 = wall2Scene
        }

        this._tryBindGroundDebug()
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active) {
            return
        }
        this._debug = debug
        this._tryBindGroundDebug()
    }

    _tryBindGroundDebug() {
        const dbg = this._debug ?? this.experience.debug
        if (this._groundDebugBound || !dbg?.active || !this.ground) {
            return
        }
        const mat = this.ground.material
        if (!mat || !('color' in mat)) {
            return
        }
        const folder = dbg.addFolder({ title: '地板', expanded: true })
        if (!folder) {
            return
        }
        const state = {
            color: `#${mat.color.getHexString()}`
        }
        folder
            .addBinding(state, 'color', { view: 'color', label: '颜色' })
            .on('change', (ev) => {
                mat.color.set(ev.value)
            })
        this._groundDebugBound = true
    }

    /** @param {number} dt seconds */
    update(dt) {
        this.factory?.update(dt ?? 0)
    }

    dispose() {
        if (this.bearingColumn) {
            this.scene.remove(this.bearingColumn)
            this.bearingColumn = null
        }
        if (this.ground) {
            this.ground.geometry?.dispose()
            const material = this.ground.material
            if (Array.isArray(material)) {
                for (const x of material) x?.dispose?.()
            } else {
                material?.dispose?.()
            }
            this.scene.remove(this.ground)
            this.ground = null
        }
        this.factory?.dispose()
        this.factory = null
        this.model = null
    }
}
