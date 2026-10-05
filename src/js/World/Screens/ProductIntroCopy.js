import '../../../product-intro-copy.css'

export default class ProductIntroCopy {
  constructor({ state, events }) {
    this.state = state
    this.loading = state.ndsStatus === 'loading'
    this.element = document.createElement('section')
    this.element.className = 'product-intro-copy'
    this.element.setAttribute('aria-labelledby', 'duo-intro-copy-title')
    this.element.innerHTML = `
      <p class="product-intro-copy__eyebrow">IPHONE DUO</p>
      <h1 class="product-intro-copy__title" id="duo-intro-copy-title">双屏之间，<br>更多可能。</h1>
      <p class="product-intro-copy__description">展开视野，装上 Controller。<br>让熟悉的游戏，拥有新的玩法。</p>`
    this.removeListeners = [
      ...['intro:state', 'product:mode'].map(event => events.on(event, () => this.render())),
      events.on('nds:state', info => { this.loading = info.loading; this.render() }),
    ]
    document.body.append(this.element)
    this.render()
  }

  render() {
    this.element.hidden = this.state.introState !== 'ready' || this.state.productMode !== 'game-home' || this.loading
  }

  destroy() {
    this.removeListeners.forEach(remove => remove())
    this.element.remove()
  }
}
