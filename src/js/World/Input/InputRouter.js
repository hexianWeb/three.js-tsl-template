import * as THREE from 'three/webgpu'

const KEY_ACTIONS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyX: 'a', KeyZ: 'b', KeyS: 'x', KeyA: 'y', KeyQ: 'l', KeyW: 'r',
  Enter: 'start', ShiftLeft: 'select', ShiftRight: 'select',
}
const PAD_ACTIONS = {
  0: 'b', 1: 'a', 2: 'y', 3: 'x', 4: 'l', 5: 'r',
  8: 'select', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right',
}

export default class InputRouter {
  constructor({ camera, canvas, interactionSurface, resolvePointerAction, resolvePointerTouch, onAction, onGameButtons, onGameTouch }) {
    this.camera = camera
    this.canvas = canvas
    this.interactionSurface = interactionSurface
    this.resolvePointerAction = resolvePointerAction
    this.resolvePointerTouch = resolvePointerTouch
    this.onAction = onAction
    this.onGameButtons = onGameButtons
    this.onGameTouch = onGameTouch
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.gamepadButtonState = new Map()
    this.keys = new Set()
    this.padActions = new Set()
    this.activeGamepads = []
    this.focused = document.hasFocus()
    this.listeners = new AbortController()
    const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: this.listeners.signal })
    listen(canvas, 'pointerdown', event => this.handlePointerDown(event))
    listen(canvas, 'pointermove', event => this.handlePointerMove(event))
    listen(canvas, 'pointerup', event => this.handlePointerUp(event))
    listen(canvas, 'pointercancel', () => this.clearPointer())
    listen(canvas, 'lostpointercapture', event => {
      if (event.pointerId === this.pointerId) this.clearPointer()
    })
    listen(window, 'keydown', event => this.handleKeyDown(event))
    listen(window, 'keyup', event => {
      this.keys.delete(event.code)
      this.publishButtons()
    })
    listen(window, 'blur', () => this.suspend())
    listen(window, 'focus', () => { this.focused = true })
    listen(document, 'visibilitychange', () => {
      if (document.hidden) this.suspend()
      else this.focused = document.hasFocus()
    })
    listen(window, 'pagehide', () => this.suspend())
    listen(document, 'focusin', event => {
      if (this.isEditableTarget(event.target)) this.clearInputs()
    })
  }

  hitUv(event) {
    for (let node = this.interactionSurface; node; node = node.parent) {
      if (!node.visible) return null
    }
    const bounds = this.canvas.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return null
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.interactionSurface.updateWorldMatrix(true, false)
    this.camera.updateWorldMatrix(true, false)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersection = this.raycaster.intersectObject(this.interactionSurface, false)[0]
    return intersection?.uv ?? null
  }

  handlePointerDown(event) {
    if (event.button !== 0 || this.pointerId != null) return
    if (this.mode === 'game-home') {
      this.homePointerId = event.pointerId
      return
    }
    if (this.mode !== 'playing') return
    const point = this.resolvePointerTouch(this.hitUv(event))
    if (!point) return
    event.preventDefault()
    this.canvas.focus({ preventScroll: true })
    this.pointerId = event.pointerId
    this.canvas.setPointerCapture(event.pointerId)
    this.onGameTouch(point)
  }

  handlePointerMove(event) {
    if (event.pointerId !== this.pointerId || this.mode !== 'playing') return
    this.onGameTouch(this.resolvePointerTouch(this.hitUv(event)))
  }

  handlePointerUp(event) {
    if (event.pointerId === this.pointerId) {
      this.clearPointer()
      return
    }
    if (event.button !== 0 || event.pointerId !== this.homePointerId) return
    this.homePointerId = null
    if (this.mode !== 'game-home') return
    const action = this.resolvePointerAction(this.hitUv(event))
    if (action) {
      event.preventDefault()
      this.dispatch(action, { userGesture: true })
    }
  }

  handleKeyDown(event) {
    if (event.code === 'Escape' && !event.repeat) {
      this.dispatch('back')
      return
    }
    if (this.isEditableTarget(event.target)) return
    if (this.mode === 'game-home' && event.code === 'Enter' && !event.repeat) {
      event.preventDefault()
      this.dispatch('continue', { userGesture: true })
      return
    }
    if (this.mode !== 'playing' || !KEY_ACTIONS[event.code]) return
    event.preventDefault()
    // 导航 Enter 的 repeat 不得变成游戏 Start；必须松开再按一次。
    if (event.repeat) return
    this.keys.add(event.code)
    this.publishButtons()
  }

  isEditableTarget(target) {
    return target instanceof HTMLElement
      && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'SUMMARY'].includes(target.tagName))
  }

  dispatch(action, options) {
    this.onAction?.(action, options)
  }

  setMode(mode) {
    this.clearInputs()
    this.mode = mode
  }

  clearPointer() {
    const pointerId = this.pointerId
    this.pointerId = null
    this.homePointerId = null
    if (pointerId != null && this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId)
    this.onGameTouch(null)
  }

  clearInputs() {
    this.keys.clear()
    this.padActions.clear()
    this.activeGamepads = []
    this.gamepadArmed = false
    this.navigationArmed = false
    this.clearPointer()
    this.lastButtons = ''
    this.onGameButtons([])
  }

  suspend() {
    this.focused = false
    this.clearInputs()
    this.dispatch('suspend')
  }

  publishButtons() {
    if (this.mode !== 'playing') return
    const actions = new Set([...this.keys].map(code => KEY_ACTIONS[code]))
    this.padActions.forEach(action => actions.add(action))
    const key = [...actions].sort().join(',')
    if (key === this.lastButtons) return
    this.lastButtons = key
    this.onGameButtons([...actions])
  }

  update() {
    if (!this.focused || document.hidden) return
    const gamepads = navigator.getGamepads?.() ?? []
    const connectedIndices = new Set()
    const actions = new Set()
    const activeGamepads = []

    for (const gamepad of gamepads) {
      if (!gamepad || gamepad.mapping !== 'standard') continue

      connectedIndices.add(gamepad.index)
      const pressed = Boolean(gamepad.buttons?.[0]?.pressed)
      const wasPressed = this.gamepadButtonState.get(gamepad.index) ?? false

      // 标准 Gamepad button 0 只在上升沿触发，避免按住 A 时逐帧重复 Continue。
      if (this.mode === 'game-home' && this.navigationArmed && pressed && !wasPressed) this.dispatch('continue')
      this.gamepadButtonState.set(gamepad.index, pressed)
      const padActions = new Set()
      Object.entries(PAD_ACTIONS).forEach(([index, action]) => {
        if (gamepad.buttons[index]?.pressed) padActions.add(action)
      })
      if (gamepad.axes[0] > 0.5) padActions.add('right')
      if (gamepad.axes[0] < -0.5) padActions.add('left')
      if (gamepad.axes[1] > 0.5) padActions.add('down')
      if (gamepad.axes[1] < -0.5) padActions.add('up')
      padActions.forEach(action => actions.add(action))
      if (padActions.size > 0) activeGamepads.push(gamepad)
    }

    this.gamepadButtonState.forEach((_, index) => {
      if (!connectedIndices.has(index)) this.gamepadButtonState.delete(index)
    })
    // Continue 使用的手柄按键须回到中立后才接管游戏，断开也会清空该来源的按键。
    if (actions.size === 0) {
      this.gamepadArmed = true
      this.navigationArmed = true
    }
    const acceptsPad = this.mode === 'playing' && this.gamepadArmed
    this.padActions = acceptsPad ? actions : new Set()
    // 须在 publishButtons 之前更新：本帧的按下边沿会同步回调 rumble()，要震到正在按的那只手柄。
    this.activeGamepads = acceptsPad ? activeGamepads : []
    this.publishButtons()
  }

  // 只震动当前正在提供输入的手柄，纯键盘操作时不会惊动闲置在一旁的手柄。
  rumble(effect) {
    this.activeGamepads.forEach((gamepad) => {
      const actuator = gamepad.vibrationActuator
      if (!actuator || actuator.effects?.includes('dual-rumble') === false) return
      actuator.playEffect('dual-rumble', effect).catch(() => {})
    })
  }

  destroy() {
    this.listeners.abort()
    this.clearInputs()
    this.gamepadButtonState.clear()
  }
}
