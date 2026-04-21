import InnerPhysicalSphere from './innerPhysicalSphere.js'
import DotSphere from './dotSphere.js'
import ClickWave from './clickWave.js'
import FlyLines from './flyLines.js'
import SpokeController from './spokeController.js'

const SAMPLE_DATA = {
    hub: { lng: 116.4, lat: 39.9 },
    targets: [
        { id: 'ny',  lng: -74.0,  lat: 40.7 },
        { id: 'lon', lng:  -0.1,  lat: 51.5 },
        { id: 'tok', lng: 139.7,  lat: 35.7 },
        { id: 'sfo', lng: -122.4, lat: 37.8 },
        { id: 'syd', lng: 151.2,  lat: -33.9 },
    ],
}

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        this.dotSphere = new DotSphere(this.scene)
        this.innerPhysicalSphere = new InnerPhysicalSphere(this.scene)
        this.flyLines = new FlyLines(this.scene)

        this.clickWave = new ClickWave({
            canvas: experience.canvas,
            camera: experience.worldCamera.instance,
            scene: this.scene,
            dotSphere: this.dotSphere,
        })

        this.spokes = new SpokeController({
            dotSphere: this.dotSphere,
            flyLines: this.flyLines,
            data: SAMPLE_DATA,
        })
    }

    /**
     * @param {import('../utils/debug.js').default} debug
     */
    debuggerInit(debug) {
        this.dotSphere.debuggerInit(debug)
        this.innerPhysicalSphere.debuggerInit(debug)
        this.flyLines.debuggerInit(debug)
        this.spokes.debuggerInit(debug)
    }

    update(delta = 0) {
        this.flyLines.update(delta)
    }

    dispose() {
        this.clickWave.dispose()
        this.innerPhysicalSphere.dispose()
        this.dotSphere.dispose()
        this.flyLines.dispose()
        this.spokes.dispose()
    }
}
