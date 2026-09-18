export default class EventBus {
  constructor() {
    this.listeners = new Map()
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }

    this.listeners.get(eventName).add(callback)
    return () => this.off(eventName, callback)
  }

  off(eventName, callback) {
    const callbacks = this.listeners.get(eventName)
    callbacks?.delete(callback)

    if (callbacks?.size === 0) {
      this.listeners.delete(eventName)
    }
  }

  emit(eventName, payload) {
    this.listeners.get(eventName)?.forEach(callback => callback(payload))
  }

  destroy() {
    this.listeners.clear()
  }
}
