import InnerPhysicalSphere from './innerPhysicalSphere.js'
import DotSphere from './dotSphere.js'

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        this.dotSphere = new DotSphere(this.scene)
        this.innerPhysicalSphere = new InnerPhysicalSphere(this.scene)
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        this.dotSphere.debuggerInit(debug)
        this.innerPhysicalSphere.debuggerInit(debug)
    }

    update() {}

    dispose() {
        this.innerPhysicalSphere.dispose()
        this.dotSphere.dispose()
    }
}
