import * as THREE from 'three/webgpu'
import { TANK_MAX_X } from './factory/config.js'
import { ROW_GAP_Z } from './factory/layout.js'
import { createFactoryGroundMaterial } from './groundMaterial.js'

/** @typedef {import('../utils/debug.js').default} Debug */

export default class FactoryFloor {
    /**
     * @param {THREE.Scene} scene
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(scene, experience) {
        this.scene = scene
        this.experience = experience
        /** @type {THREE.Mesh | null} */
        this.ground = null
        /** 承重柱（地板地形）；与 ground 同层，不参与 factory.root 取景。 */
        /** @type {THREE.Object3D | null} */
        this.bearingColumn1 = null
        /** @type {THREE.Object3D | null} */
        this.bearingColumn2 = null
        /** @type {Debug | null} */
        this._debug = null
        /** @type {boolean} */
        this._groundDebugBound = false
    }

    /**
     * 铺在车间下方的大地板；挂在 scene 上而非 factory.root，避免参与取景包围盒把相机拉得过远。
     */
    addToScene() {
        if (!this.ground) {
            const geometry = new THREE.PlaneGeometry(1000, 1000)
            geometry.rotateX(-Math.PI / 2)
            const material = createFactoryGroundMaterial()
            const mesh = new THREE.Mesh(geometry, material)
            mesh.name = 'FactoryGround'
            mesh.position.set(TANK_MAX_X / 2, -18 * 1.5, 0)
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
     * @param {Debug} debug
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
        if (mat?.colorNode) {
            this._groundDebugBound = true
            return
        }
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

    dispose() {
        if (this.bearingColumn1) {
            this.scene.remove(this.bearingColumn1)
            this.bearingColumn1 = null
        }
        if (this.bearingColumn2) {
            this.scene.remove(this.bearingColumn2)
            this.bearingColumn2 = null
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
    }
}
