import { gsap } from 'gsap'
import * as THREE from 'three/webgpu'
import Experience from '../../Experience.js'
import ControllerDisplay from './ControllerDisplay.js'
import PhoneScreenSurface from './PhoneScreenSurface.js'

export default class ScreenManager {
  constructor({
    topScreen,
    bottomScreen,
    bottomDisplay,
    phoneHomeTexture,
    gameHomeTexture,
    onPreviewAngle,
    onDebugModeChange,
  }) {
    this.experience = new Experience()
    this.debug = this.experience.debug
    this.screens = { topScreen, bottomScreen, bottomDisplay }
    this.onDebugModeChange = onDebugModeChange
    this.params = {
      transitionProgress: 0,
      transitionHold: 0.15,
      transitionDuration: 0.75,
    }
    this.transitionState = { value: 0 }
    this.mode = null

    this.validateScreens()
    this.captureOriginalState()
    this.createOffMaterials()
    this.phoneSurface = new PhoneScreenSurface({
      topScreen,
      bottomScreen,
      phoneHomeTexture,
      gameHomeTexture,
      onPreviewAngle,
      onDebugModeChange,
    })
    this.controllerDisplay = new ControllerDisplay({ screen: bottomDisplay })
    this.applyMode()
    this.debugInit()
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

  createOffMaterials() {
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
      this.setGameChangerProgress(0)
      this.setScreenMaterial(topScreen, this.phoneSurface.topMaterial, true)
      this.setScreenMaterial(bottomScreen, this.phoneSurface.bottomMaterial, true)
      // 显示层隐藏后，Controller 中央镂空会直接露出手机原生下屏。
      this.setScreenMaterial(bottomDisplay, this.controllerDisplay.material, false)
      return
    }

    if (this.mode === 'game-home') {
      this.controllerDisplay.drawGameHome()
      this.setScreenMaterial(topScreen, this.phoneSurface.topMaterial, true)
      this.setScreenMaterial(bottomScreen, this.phoneSurface.bottomMaterial, false)
      this.setScreenMaterial(bottomDisplay, this.controllerDisplay.material, true)
      this.setGameChangerProgress(1)
      return
    }

    if (this.mode === 'playing') {
      this.controllerDisplay.drawPlayingPlaceholder()
      this.setScreenMaterial(topScreen, this.phoneSurface.topMaterial, true)
      this.setScreenMaterial(bottomScreen, this.phoneSurface.bottomMaterial, false)
      this.setScreenMaterial(bottomDisplay, this.controllerDisplay.material, true)
      this.setGameChangerProgress(1)
      return
    }

    this.setScreenOff(topScreen, true)
    this.setScreenOff(bottomScreen, true)
    this.setScreenMaterial(bottomDisplay, this.controllerDisplay.material, false)
  }

  setProductAngle(angle) {
    this.phoneSurface.setProductAngle(angle)
  }

  setPhoneWakeProgress(progress) {
    this.phoneSurface.setWakeProgress(progress)
  }

  playGameChangerTransition({ onComplete } = {}) {
    this.killGameChangerTransition()
    this.controllerDisplay.drawGameHome()
    this.setScreenMaterial(
      this.screens.bottomDisplay,
      this.controllerDisplay.material,
      false,
    )
    this.transitionState.value = 0
    this.setGameChangerProgress(0)

    this.gameChangerTimeline = gsap.timeline({
      onComplete: () => {
        this.gameChangerTimeline = null
        this.setGameChangerProgress(1)
        onComplete?.()
      },
    })
    this.gameChangerTimeline
      .to({}, { duration: this.params.transitionHold })
      .to(this.transitionState, {
        value: 1,
        duration: this.params.transitionDuration,
        ease: 'power2.inOut',
        onUpdate: () => this.setGameChangerProgress(this.transitionState.value),
      })
  }

  setGameChangerProgress(progress) {
    const value = THREE.MathUtils.clamp(progress, 0, 1)
    this.params.transitionProgress = value
    this.transitionState.value = value
    this.phoneSurface.setTransitionProgress(value)
    this.controllerDisplay.setTransitionProgress(value)

    if (this.mode === 'attaching' || this.mode === 'game-home') {
      this.screens.bottomScreen.visible = value < 0.999
      this.screens.bottomDisplay.visible = value > 0.001
    }
    this.transitionProgressBinding?.refresh()
  }

  completeGameChangerTransition() {
    this.killGameChangerTransition()
    this.controllerDisplay.drawGameHome()
    this.setScreenMaterial(
      this.screens.bottomDisplay,
      this.controllerDisplay.material,
      true,
    )
    this.setGameChangerProgress(1)
  }

  killGameChangerTransition() {
    this.gameChangerTimeline?.kill()
    this.gameChangerTimeline = null
  }

  inspectTransparentController() {
    this.killGameChangerTransition()
    this.onDebugModeChange?.('attaching')
    this.setGameChangerProgress(0)
  }

  replayGameChangerTransition() {
    this.onDebugModeChange?.('attaching')
    this.playGameChangerTransition({
      onComplete: () => this.onDebugModeChange?.('game-home'),
    })
  }

  setScreenMaterial(screen, material, visible) {
    screen.material = material
    screen.visible = visible
  }

  setScreenOff(screen, visible) {
    this.setScreenMaterial(screen, this.offMaterials.get(screen), visible)
  }

  getActionAtUv(uv) {
    if (this.mode !== 'game-home') return null
    return this.controllerDisplay.getActionAtUv(uv)
  }

  debugInit() {
    const folder = this.debug.ui.addFolder({ title: 'Game Changer Transition' })
    this.transitionProgressBinding = folder.addBinding(this.params, 'transitionProgress', {
      label: 'Progress', min: 0, max: 1, step: 0.01,
    }).on('change', ({ value }) => {
      this.killGameChangerTransition()
      this.onDebugModeChange?.('attaching')
      this.setGameChangerProgress(value)
    })
    folder.addBinding(this.params, 'transitionHold', {
      label: 'Hold', min: 0, max: 2, step: 0.05,
    })
    folder.addBinding(this.params, 'transitionDuration', {
      label: 'Duration', min: 0.1, max: 3, step: 0.05,
    })
    folder.addButton({ title: 'Inspect Transparent' })
      .on('click', () => this.inspectTransparentController())
    folder.addButton({ title: 'Replay Transition' })
      .on('click', () => this.replayGameChangerTransition())
    folder.addButton({ title: 'Complete Transition' })
      .on('click', () => {
        this.completeGameChangerTransition()
        this.onDebugModeChange?.('game-home')
      })
  }

  update() {
    this.controllerDisplay.update()
  }

  destroy() {
    this.killGameChangerTransition()
    Object.values(this.screens).forEach((screen) => {
      const original = this.originalState.get(screen)
      screen.material = original.material
      screen.visible = original.visible
    })
    this.phoneSurface.destroy()
    this.controllerDisplay.destroy()
    this.offMaterials.forEach(material => material.dispose())
    this.offMaterials.clear()
  }
}
