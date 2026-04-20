import InnerPhysicalSphere from './innerPhysicalSphere.js'
import DotSphere from './dotSphere.js'
import ClickWave from './clickWave.js'

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        this.dotSphere = new DotSphere(this.scene)
        this.innerPhysicalSphere = new InnerPhysicalSphere(this.scene)

        this.clickWave = new ClickWave({
            canvas: experience.canvas,
            camera: experience.worldCamera.instance,
            scene: this.scene,
            dotSphere: this.dotSphere,
        })
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
        this.clickWave.dispose()
        this.innerPhysicalSphere.dispose()
        this.dotSphere.dispose()
    }
}
