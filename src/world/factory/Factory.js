import * as THREE from 'three/webgpu'
import { createFactoryState } from './state/FactoryState.js'
import FactoryController from './FactoryController.js'
import Rails from './entities/Rails.js'
import TankField from './entities/TankField.js'
import { FlybarPool } from './entities/Flybar.js'
import Crane from './entities/Crane.js'
import { FACTORY_CONFIG } from './config.js'

export default class Factory {
    /**
     * @param {{
     *   craneScene: THREE.Object3D,
     *   flybarScene: THREE.Object3D,
     *   tankBoxScene: THREE.Object3D,
     *   railwayScene: THREE.Object3D
     * }} resources
     */
    constructor({ craneScene, flybarScene, tankBoxScene, railwayScene }) {
        this.root = new THREE.Group()
        this.root.name = 'Factory'

        this.state = createFactoryState()

        this.rails = new Rails(railwayScene)
        this.root.add(this.rails.root)

        this.tankField = new TankField(tankBoxScene, this.state.tanks)
        this.root.add(this.tankField.root)

        this.flybarPool = new FlybarPool(flybarScene, this.state.flybars.length)

        this.cranes = new Map()
        for (const cs of this.state.cranes) {
            const cfg = FACTORY_CONFIG.cranes.find((c) => c.id === cs.id)
            const crane = new Crane({
                id: cs.id,
                prototypeScene: craneScene,
                state: cs,
                initialPosition: new THREE.Vector3(cfg?.initialX ?? 0, cfg?.initialY ?? 0, cfg?.initialZ ?? 0)
            })
            this.cranes.set(cs.id, crane)
            this.root.add(crane.root)
        }

        for (const fb of this.state.flybars) {
            if (fb.location.kind === 'tank') {
                const anchor = this.tankField.getAnchor(fb.location.tankId)
                const flybar = this.flybarPool.get(fb.id)
                anchor.add(flybar.root)
                flybar.root.position.set(0, 0, 0)
            }
        }

        for (const cs of this.state.cranes) {
            const crane = this.cranes.get(cs.id)
            crane.setMode(cs.mode)
        }

        this.controller = new FactoryController(this.state, this.cranes, this.flybarPool, this.tankField)
    }

    update(dt) {
        this.controller.update(dt)
        for (const c of this.cranes.values()) c.update(dt)
        this.tankField.update?.(dt)
    }

    dispose() {
        this.controller.pause()
        for (const c of this.cranes.values()) c.dispose()
        this.cranes.clear()
        this.tankField?.dispose()
        this.rails?.dispose()
        this.flybarPool?.dispose()
        this.root.parent?.remove(this.root)
    }
}
