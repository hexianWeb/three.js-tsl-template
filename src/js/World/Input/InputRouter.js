import * as THREE from 'three/webgpu'

export default class InputRouter {
  constructor({ camera, canvas, interactionSurface, resolvePointerAction, onAction }) {
    this.camera = camera
    this.canvas = canvas
    this.interactionSurface = interactionSurface
    this.resolvePointerAction = resolvePointerAction
    this.onAction = onAction
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.gamepadButtonState = new Map()

    this.handlePointerUp = this.handlePointerUp.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('keydown', this.handleKeyDown)
  }

  handlePointerUp(event) {
    if (event.button !== 0) return

    const bounds = this.canvas.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersection = this.raycaster.intersectObject(this.interactionSurface, false)[0]
    const action = this.resolvePointerAction(intersection?.uv)

    if (action) {
      event.preventDefault()
      this.dispatch(action)
    }
  }

  handleKeyDown(event) {
    if (event.repeat || this.isEditableTarget(event.target)) return

    if (event.key === 'Enter') {
      this.dispatch('continue')
    }
    else if (event.key === 'Escape') {
      this.dispatch('back')
    }
  }

  isEditableTarget(target) {
    return target instanceof HTMLElement
      && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName))
  }

  dispatch(action) {
    this.onAction?.(action)
  }

  update() {
    const gamepads = navigator.getGamepads?.() ?? []
    const connectedIndices = new Set()

    for (const gamepad of gamepads) {
      if (!gamepad || gamepad.mapping !== 'standard') continue

      connectedIndices.add(gamepad.index)
      const pressed = Boolean(gamepad.buttons?.[0]?.pressed)
      const wasPressed = this.gamepadButtonState.get(gamepad.index) ?? false

      // 标准 Gamepad button 0 只在上升沿触发，避免按住 A 时逐帧重复 Continue。
      if (pressed && !wasPressed) this.dispatch('continue')
      this.gamepadButtonState.set(gamepad.index, pressed)
    }

    this.gamepadButtonState.forEach((_, index) => {
      if (!connectedIndices.has(index)) this.gamepadButtonState.delete(index)
    })
  }

  destroy() {
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('keydown', this.handleKeyDown)
    this.gamepadButtonState.clear()
  }
}
