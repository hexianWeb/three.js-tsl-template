export default class State {
  constructor() {
    this.introState = 'loading'
    this.productMode = null
  }

  setIntroState(state) {
    this.introState = state
  }

  setProductMode(mode) {
    this.productMode = mode
  }
}
