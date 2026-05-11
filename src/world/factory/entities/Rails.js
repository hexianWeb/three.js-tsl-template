import * as THREE from 'three/webgpu'
import { FACTORY_CONFIG } from '../config.js'

export default class Rails {
    /**
     * @param {THREE.Object3D} railwayScene railway.glb 的 scene
     */
    constructor(railwayScene) {
        this.root = new THREE.Group()
        this.root.name = 'Rails'

        for (const pos of getRailPositions()) {
            const rail = railwayScene.clone(true)
            rail.position.set(pos[0], pos[1], pos[2])
            rail.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true
                    child.receiveShadow = true
                }
            })
            this.root.add(rail)
        }
    }

    dispose() {
        // GLB geometry/material/texture belong to Resources; Rails only removes clones.
        this.root.parent?.remove(this.root)
    }
}

function getRailPositions() {
    if (FACTORY_CONFIG.rails.positions) {
        return FACTORY_CONFIG.rails.positions
    }

    return FACTORY_CONFIG.tanks.rowZ.flatMap((rowZ) =>
        FACTORY_CONFIG.rails.rowOffsets.map(([x, y, zOffset]) => [x, y, rowZ + zOffset])
    )
}
