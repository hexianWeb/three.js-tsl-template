import { Pane } from 'tweakpane'

export default class Debug {
  constructor(container) {
    this.ui = new Pane({
      container,
      title: 'iPhone Duo · WebGPU',
    })
  }

  destroy() {
    this.ui.dispose()
  }
}
