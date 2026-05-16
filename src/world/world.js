import KtxTextureSequence from './KtxTextureSequence.js'

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene

        this.ktxTextureSequence = new KtxTextureSequence(experience)
    }

    /**
     * @param {import('../utils/debug.js').default} _debug
     */
    debuggerInit(_debug) {}

    update() {
        this.ktxTextureSequence.update()
    }

    dispose() {
        this.ktxTextureSequence.dispose()
    }
}
