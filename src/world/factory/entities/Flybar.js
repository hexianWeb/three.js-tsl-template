export class Flybar {
    /**
     * @param {number} id
     * @param {import('three/webgpu').Object3D} prototypeScene
     */
    constructor(id, prototypeScene) {
        this.id = id
        this.root = prototypeScene.clone(true)
        this.root.name = `Flybar-${id}`
    }

    dispose() {
        // GLB geometry/material/texture belong to Resources; Flybar only removes its clone.
        this.root.parent?.remove(this.root)
    }
}

export class FlybarPool {
    /**
     * @param {import('three/webgpu').Object3D} prototypeScene
     * @param {number} count
     */
    constructor(prototypeScene, count) {
        this.flybars = []
        for (let i = 0; i < count; i++) {
            this.flybars.push(new Flybar(i, prototypeScene))
        }
    }

    get(id) {
        return this.flybars[id]
    }

    dispose() {
        this.flybars.forEach((f) => f.dispose())
    }
}
