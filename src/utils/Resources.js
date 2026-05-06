import sources from '../sources.js'
import { eventBus } from './event-bus.js'

export default class Resources {
  constructor() {
    this.items = {}
    this.sources = sources
    this.toLoad = sources.length
    this.loaded = 0

    this.ready = new Promise(resolve => {
      this._resolveReady = resolve
    })

    if (this.toLoad === 0) {
      this._resolveReady()
      eventBus.emit('source ready')
      return
    }
    // TODO: implement startLoading in next tasks
  }
}
