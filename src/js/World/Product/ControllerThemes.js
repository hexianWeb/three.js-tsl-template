import * as THREE from 'three/webgpu'
import { gsap } from 'gsap'

export default class ControllerThemes {
  constructor({ product, colorDock, state, events }) {
    this.product = product
    this.colorDock = colorDock
    this.state = state
    this.events = events
    this.classic = product.getControllerColors()
    this.removeListeners = [
      events.on('controller:theme-request', ({ key }) => this.select(key)),
      events.on('controller:themes-updated', () => this.select(state.controllerTheme, { force: true })),
      events.on('product:mode', () => this.finishTransition()),
    ]
    colorDock.setSelectedTheme(state.controllerTheme)
  }

  select(key, { force = false } = {}) {
    const theme = this.colorDock.themes.find(item => item.key === key)
    if (!theme || this.state.productMode !== 'game-home' || this.state.introState !== 'ready'
      || this.state.ndsStatus === 'loading') return
    if (!force && key === this.state.controllerTheme) return

    this.timeline?.kill()
    const from = this.product.getControllerColors()
    const target = {
      shell: new THREE.Color(theme.shell),
      buttons: Object.fromEntries(Object.entries(from.buttons).map(([part, colors]) => [
        part, colors.map(() => new THREE.Color(part === 'dpad' ? theme.dpad : theme.buttons)),
      ])),
    }
    // Classic 精确恢复各按键的初始底色，不把多材质或不同 ABXY 原色合并成一枚色值。
    if (key === 'classic' && !force) target.buttons = this.classic.buttons
    this.targetColors = target
    const progress = { value: 0 }
    const colors = this.product.getControllerColors()
    const apply = () => {
      // Three.Color 在线性色彩空间插值，避免用十六进制字符串插值造成中间帧亮度跳变。
      colors.shell.lerpColors(from.shell, target.shell, progress.value)
      Object.entries(colors.buttons).forEach(([part, values]) => {
        values.forEach((color, index) => color.lerpColors(from.buttons[part][index], target.buttons[part][index], progress.value))
      })
      this.product.setControllerColors(colors)
    }
    this.state.controllerTheme = key
    this.colorDock.setSelectedTheme(key)
    this.events.emit('controller:theme', { key, label: theme.label })
    this.timeline = gsap.to(progress, {
      value: 1,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.4,
      ease: 'power2.out',
      onUpdate: apply,
      onComplete: () => this.finishTransition(),
    })
  }

  finishTransition() {
    if (!this.targetColors) return
    this.timeline?.kill()
    this.timeline = null
    // 精确写入终点，消除插值末帧的浮点余差；重播或进入游戏时也在已选配色收束。
    this.product.setControllerColors(this.targetColors)
    this.product.controllerShellMaterial.refreshColor()
    this.targetColors = null
  }

  destroy() {
    this.timeline?.kill()
    this.targetColors = null
    this.removeListeners.forEach(remove => remove())
  }
}
