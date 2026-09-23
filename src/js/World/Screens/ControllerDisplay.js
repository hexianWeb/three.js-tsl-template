import * as THREE from 'three/webgpu'
import { uniform } from 'three/tsl'
import Experience from '../../Experience.js'
import { controllerTransitionColor } from '../../../shaders/screenEffects.js'

const CONTINUE_REGION = {
  minX: 0.07,
  maxX: 0.66,
  minY: 0.2,
  maxY: 0.53,
}

export default class ControllerDisplay {
  constructor({ screen }) {
    this.experience = new Experience()
    this.debug = this.experience.debug
    this.screen = screen
    this.params = {
      brightness: 0.58,
      blurPixels: 12,
      scale: 1.03,
    }
    this.transitionProgress = 0
    this.gameInfo = { title: 'Nintendo DS', detail: 'Choose a local NDS game' }

    this.createCanvas()
    this.createMaterial()
    this.drawGameHome()
    this.setTransitionProgress(0)
    this.debugInit()
  }

  createCanvas() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 1024
    this.canvas.height = 1024
    this.context = this.canvas.getContext('2d')
    if (!this.context) {
      throw new Error('无法创建 Controller 显示屏 Canvas 2D Context。')
    }

    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.name = 'Controller_Display_UI'
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
    // Game Mode 下屏相对 Mesh UV 旋转 -90°，再沿纹理 U 左右镜像一次。
    this.texture.center.set(0.5, 0.5)
    this.texture.repeat.set(-1, 1)
    this.texture.rotation = -Math.PI / 2
    this.texture.updateMatrix()
    this.interactionUv = new THREE.Vector2()
    this.frameDirty = false
  }

  createMaterial() {
    this.uniforms = {
      controllerBlur: uniform(0),
      controllerUvScale: uniform(1),
      controllerOpacity: uniform(0),
      controllerBrightness: uniform(this.params.brightness),
    }
    this.material = new THREE.MeshBasicNodeMaterial({
      side: this.getPrimaryMaterial()?.side ?? THREE.FrontSide,
      transparent: true,
      depthWrite: false,
      toneMapped: true,
    })
    this.material.name = 'Controller_Display_UI_Material'
    this.material.colorNode = controllerTransitionColor(
      this.texture,
      this.uniforms,
    ).mul(this.uniforms.controllerBrightness)
    this.material.opacityNode = this.uniforms.controllerOpacity
  }

  getPrimaryMaterial() {
    return Array.isArray(this.screen.material) ? this.screen.material[0] : this.screen.material
  }

  setTransitionProgress(progress) {
    const value = THREE.MathUtils.clamp(progress, 0, 1)
    this.transitionProgress = value
    this.uniforms.controllerBlur.value = (
      this.params.blurPixels * (1 - value)
    ) / this.canvas.width
    this.uniforms.controllerUvScale.value = 1 / THREE.MathUtils.lerp(
      this.params.scale,
      1,
      value,
    )
    this.uniforms.controllerOpacity.value = value
    this.uniforms.controllerBrightness.value = this.params.brightness
  }

  drawGameHome() {
    const context = this.context
    const size = this.canvas.width
    const gradient = context.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, '#d9edff')
    gradient.addColorStop(0.55, '#f1f5fb')
    gradient.addColorStop(1, '#f7eadf')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)

    context.fillStyle = '#24456f'
    context.font = '600 38px Inter, system-ui, sans-serif'
    context.textAlign = 'left'
    context.fillText('Good to see you.', 72, 112)
    context.fillStyle = '#6c7f98'
    context.font = '500 24px Inter, system-ui, sans-serif'
    context.fillText('Play. Explore. Create.', 72, 150)
    context.textAlign = 'right'
    context.fillStyle = '#24456f'
    context.font = '600 24px Inter, system-ui, sans-serif'
    context.fillText('9:41', 932, 102)

    const gameCard = this.getContinueRegionPixels()
    this.drawRoundedRect(gameCard.x, gameCard.y, gameCard.width, gameCard.height, 38, 'rgba(255,255,255,0.74)')
    const artGradient = context.createLinearGradient(gameCard.x, gameCard.y, gameCard.x + 170, gameCard.y + gameCard.height)
    artGradient.addColorStop(0, '#f8c9b8')
    artGradient.addColorStop(0.55, '#9e98c6')
    artGradient.addColorStop(1, '#3e547d')
    this.drawRoundedRect(gameCard.x + 24, gameCard.y + 24, 190, gameCard.height - 48, 28, artGradient)
    context.fillStyle = 'rgba(255,241,211,0.9)'
    context.beginPath()
    context.arc(gameCard.x + 155, gameCard.y + 86, 36, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#24334f'
    context.textAlign = 'left'
    context.font = '700 34px Inter, system-ui, sans-serif'
    context.fillText(this.gameInfo.title.slice(0, 21), gameCard.x + 238, gameCard.y + 92, 330)
    context.fillStyle = '#75849a'
    context.font = '500 23px Inter, system-ui, sans-serif'
    context.fillText(this.gameInfo.detail.slice(0, 32), gameCard.x + 238, gameCard.y + 130, 330)
    context.fillStyle = '#0a6ee8'
    context.font = '650 25px Inter, system-ui, sans-serif'
    context.fillText('Continue  ›', gameCard.x + 238, gameCard.y + 184)

    this.drawMenuCard(704, 205, 116, 274, '#ddebff', '#1677eb', '▦', 'Library')
    this.drawMenuCard(838, 205, 116, 274, '#ffe5e8', '#e9536c', '♪', 'Audio')
    this.drawMenuCard(72, 570, 430, 166, 'rgba(255,255,255,0.66)', '#2f9d70', '◆', 'Discover')
    this.drawMenuCard(522, 570, 432, 166, 'rgba(255,255,255,0.66)', '#69798d', '⚙', 'Settings')

    context.fillStyle = '#728399'
    context.font = '500 22px Inter, system-ui, sans-serif'
    context.textAlign = 'center'
    context.fillText('ENTER  ·  CONTROLLER A', size / 2, 900)
    this.frameDirty = true
  }

  drawMenuCard(x, y, width, height, background, accent, icon, label) {
    this.drawRoundedRect(x, y, width, height, 32, background)
    this.context.fillStyle = accent
    this.context.textAlign = 'center'
    this.context.font = '700 44px Inter, system-ui, sans-serif'
    this.context.fillText(icon, x + width / 2, y + height * 0.48)
    this.context.font = '600 23px Inter, system-ui, sans-serif'
    this.context.fillText(label, x + width / 2, y + height * 0.73)
  }

  setGameInfo(info) {
    this.gameInfo = { ...this.gameInfo, ...info }
    this.drawGameHome()
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
    this.context.beginPath()
    this.context.roundRect(x, y, width, height, radius)
    this.context.fillStyle = color
    this.context.fill()
  }

  getActionAtUv(uv) {
    if (!uv) return null

    const canvasUv = this.texture.transformUv(this.interactionUv.copy(uv))
    const isContinue = canvasUv.x >= CONTINUE_REGION.minX
      && canvasUv.x <= CONTINUE_REGION.maxX
      && canvasUv.y >= CONTINUE_REGION.minY
      && canvasUv.y <= CONTINUE_REGION.maxY
    return isContinue ? 'continue' : null
  }

  debugInit() {
    const folder = this.debug.ui.addFolder({ title: 'Controller Display' })
    const ranges = {
      brightness: [0, 2, 0.01],
      blurPixels: [0, 30, 1],
      scale: [1, 1.12, 0.005],
    }
    Object.entries(ranges).forEach(([key, [min, max, step]]) => {
      folder.addBinding(this.params, key, { label: key, min, max, step })
        .on('change', () => this.setTransitionProgress(this.transitionProgress))
    })
  }

  update() {
    if (!this.frameDirty) return

    this.texture.needsUpdate = true
    this.frameDirty = false
  }

  destroy() {
    this.material.dispose()
    this.texture.dispose()
    this.context = null
    this.canvas = null
  }
}
