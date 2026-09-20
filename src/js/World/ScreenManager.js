import * as THREE from 'three/webgpu'

const CONTINUE_REGION = {
  minX: 0.14,
  maxX: 0.86,
  minY: 0.48,
  maxY: 0.7,
}

export default class ScreenManager {
  constructor({ topScreen, bottomScreen, bottomDisplay }) {
    this.screens = { topScreen, bottomScreen, bottomDisplay }
    this.validateScreens()
    this.captureOriginalState()
    this.createMaterials()
    this.mode = null
    this.applyMode()
  }

  validateScreens() {
    Object.entries(this.screens).forEach(([key, screen]) => {
      if (!screen?.isMesh) {
        throw new Error(`${key} 必须是可渲染的屏幕 Mesh。`)
      }
      if (!screen.geometry?.attributes?.uv) {
        throw new Error(`${screen.name} 缺少屏幕 UV。`)
      }
    })
  }

  captureOriginalState() {
    this.originalState = new Map()
    Object.values(this.screens).forEach((screen) => {
      this.originalState.set(screen, {
        material: screen.material,
        visible: screen.visible,
      })
    })
  }

  createMaterials() {
    this.offMaterials = new Map()
    Object.values(this.screens).forEach((screen) => {
      const material = new THREE.MeshBasicNodeMaterial({
        color: '#000000',
        side: this.getPrimaryMaterial(screen)?.side ?? THREE.FrontSide,
        toneMapped: false,
      })
      material.name = `${screen.name}_Off_Material`
      this.offMaterials.set(screen, material)
    })

    this.canvas = document.createElement('canvas')
    this.canvas.width = 1024
    this.canvas.height = 1024
    this.context = this.canvas.getContext('2d')
    if (!this.context) {
      throw new Error('无法创建 Controller 显示屏 Canvas 2D Context。')
    }

    this.canvasTexture = new THREE.CanvasTexture(this.canvas)
    this.canvasTexture.name = 'Controller_Display_UI'
    this.canvasTexture.colorSpace = THREE.SRGBColorSpace
    this.canvasTexture.minFilter = THREE.LinearFilter
    this.canvasTexture.magFilter = THREE.LinearFilter
    this.canvasTexture.generateMipmaps = false
    this.configureCanvasTextureOrientation()
    this.interactionUv = new THREE.Vector2()
    this.frameDirty = false

    this.canvasMaterial = new THREE.MeshBasicNodeMaterial({
      color: '#ffffff',
      map: this.canvasTexture,
      side: this.getPrimaryMaterial(this.screens.bottomDisplay)?.side ?? THREE.FrontSide,
      toneMapped: false,
    })
    this.canvasMaterial.name = 'Controller_Display_UI_Material'
  }

  configureCanvasTextureOrientation() {
    this.canvasTexture.center.set(0.5, 0.5)
    this.canvasTexture.repeat.set(-1, 1)
    this.canvasTexture.rotation = -1*Math.PI / 2
    this.canvasTexture.updateMatrix()
  }

  getPrimaryMaterial(screen) {
    return Array.isArray(screen.material) ? screen.material[0] : screen.material
  }

  setMode(mode) {
    if (this.mode === mode) return

    this.mode = mode
    this.applyMode()
  }

  applyMode() {
    const { topScreen, bottomScreen, bottomDisplay } = this.screens

    if (this.mode === 'phone' || this.mode === 'attaching') {
      this.restoreScreen(topScreen)
      this.restoreScreen(bottomScreen)
      this.setScreenOff(bottomDisplay, true)
      return
    }

    if (this.mode === 'game-home') {
      this.restoreScreen(topScreen)
      this.setScreenOff(bottomScreen, false)
      this.drawGameHome()
      this.setScreenMaterial(bottomDisplay, this.canvasMaterial, true)
      return
    }

    if (this.mode === 'playing') {
      this.restoreScreen(topScreen)
      this.setScreenOff(bottomScreen, false)
      this.drawPlayingPlaceholder()
      this.setScreenMaterial(bottomDisplay, this.canvasMaterial, true)
      return
    }

    this.setScreenOff(topScreen, true)
    this.setScreenOff(bottomScreen, true)
    this.setScreenOff(bottomDisplay, true)
  }

  restoreScreen(screen) {
    const original = this.originalState.get(screen)
    screen.material = original.material
    screen.visible = original.visible
  }

  setScreenMaterial(screen, material, visible) {
    screen.material = material
    screen.visible = visible
  }

  setScreenOff(screen, visible) {
    this.setScreenMaterial(screen, this.offMaterials.get(screen), visible)
  }

  drawGameHome() {
    const context = this.context
    const size = this.canvas.width
    const gradient = context.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, '#f8f8fa')
    gradient.addColorStop(1, '#dfe3e9')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)

    context.fillStyle = '#6f7480'
    context.font = '600 30px Inter, system-ui, sans-serif'
    context.textAlign = 'center'
    context.fillText('GAME HOME', size / 2, 156)

    context.fillStyle = '#17191d'
    context.font = '700 72px Inter, system-ui, sans-serif'
    context.fillText('Ready to play', size / 2, 310)

    const button = this.getContinueRegionPixels()
    this.drawRoundedRect(button.x, button.y, button.width, button.height, 54, '#17191d')
    context.fillStyle = '#ffffff'
    context.font = '650 58px Inter, system-ui, sans-serif'
    context.fillText('Continue', size / 2, button.y + button.height * 0.64)

    context.fillStyle = '#747984'
    context.font = '500 28px Inter, system-ui, sans-serif'
    context.fillText('ENTER  ·  CONTROLLER A', size / 2, 840)
    this.frameDirty = true
  }

  drawPlayingPlaceholder() {
    const context = this.context
    const size = this.canvas.width
    const gradient = context.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, '#151922')
    gradient.addColorStop(1, '#080a0f')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)

    context.fillStyle = '#91a7c8'
    context.font = '600 30px Inter, system-ui, sans-serif'
    context.textAlign = 'center'
    context.fillText('PLAYING', size / 2, 190)

    context.fillStyle = '#f7f9fc'
    context.font = '700 62px Inter, system-ui, sans-serif'
    context.fillText('Game output', size / 2, 430)
    context.fillText('placeholder', size / 2, 510)

    context.fillStyle = '#9299a8'
    context.font = '500 28px Inter, system-ui, sans-serif'
    context.fillText('NDS runtime is not connected yet', size / 2, 650)
    context.fillText('Press ESC to return', size / 2, 820)
    this.frameDirty = true
  }

  getContinueRegionPixels() {
    const size = this.canvas.width
    return {
      x: CONTINUE_REGION.minX * size,
      y: CONTINUE_REGION.minY * size,
      width: (CONTINUE_REGION.maxX - CONTINUE_REGION.minX) * size,
      height: (CONTINUE_REGION.maxY - CONTINUE_REGION.minY) * size,
    }
  }

  drawRoundedRect(x, y, width, height, radius, color) {
    const context = this.context
    context.beginPath()
    context.roundRect(x, y, width, height, radius)
    context.fillStyle = color
    context.fill()
  }

  getActionAtUv(uv) {
    if (this.mode !== 'game-home' || !uv) return null

    // 与纹理共用同一 UV 矩阵；transformUv 同时包含 CanvasTexture 默认的 flipY。
    const canvasUv = this.canvasTexture.transformUv(this.interactionUv.copy(uv))
    const screenX = canvasUv.x
    const screenY = canvasUv.y
    const isContinue = screenX >= CONTINUE_REGION.minX
      && screenX <= CONTINUE_REGION.maxX
      && screenY >= CONTINUE_REGION.minY
      && screenY <= CONTINUE_REGION.maxY

    return isContinue ? 'continue' : null
  }

  update() {
    if (!this.frameDirty) return

    this.canvasTexture.needsUpdate = true
    this.frameDirty = false
  }

  destroy() {
    Object.values(this.screens).forEach(screen => this.restoreScreen(screen))
    this.canvasMaterial.dispose()
    this.offMaterials.forEach(material => material.dispose())
    this.offMaterials.clear()
    this.canvasTexture.dispose()
    this.context = null
    this.canvas = null
  }
}
