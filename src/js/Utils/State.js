export default class State {
  constructor() {
    this.introState = 'loading'
    this.productMode = null
    this.ndsStatus = 'idle'
    this.ndsRomName = ''
    this.controllerTheme = 'classic'
  }

  setIntroState(state) {
    this.introState = state
  }

  setProductMode(mode) {
    this.productMode = mode
  }
}
