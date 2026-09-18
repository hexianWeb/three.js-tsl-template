export default class Sizes {
  constructor() {
    this.resizeCallbacks = new Set()
    this.handleResize = this.handleResize.bind(this)

    this.updateValues()
    window.addEventListener('resize', this.handleResize)
  }

  updateValues() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.pixelRatio = Math.min(window.devicePixelRatio, 2)
  }

  handleResize() {
    this.updateValues()
    this.resizeCallbacks.forEach(callback => callback(this))
  }

  onResize(callback) {
    this.resizeCallbacks.add(callback)
    return () => this.resizeCallbacks.delete(callback)
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize)
    this.resizeCallbacks.clear()
  }
}
