import * as THREE from 'three/webgpu'

export default class Time {
  constructor() {
    this.timer = new THREE.Timer()
    this.timer.connect(document)
    this.elapsed = 0
    this.delta = 0
  }

  update() {
    this.timer.update()
    this.elapsed = this.timer.getElapsed()
    this.delta = this.timer.getDelta()
  }

  destroy() {
    this.timer.disconnect()
  }
}
