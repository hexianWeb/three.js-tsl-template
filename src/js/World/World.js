import Experience from '../Experience.js'
import NDSPlayer from '../NDS/NDSPlayer.js'
import CameraDirector from './Directors/CameraDirector.js'
import IntroDirector from './Directors/IntroDirector.js'
import Environment from './Environment/Environment.js'
import Stage from './Environment/Stage.js'
import InputRouter from './Input/InputRouter.js'
import ControllerFeedback from './Product/ControllerFeedback.js'
import ModelAdapter from './Product/ModelAdapter.js'
import ScreenManager from './Screens/ScreenManager.js'

export default class World {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.resources = this.experience.resources
    this.debug = this.experience.debug
    this.events = this.experience.events
    this.state = this.experience.state

    this.setEnvironment()
    this.setProduct()
    this.setControllerFeedback()
    this.setStage()
    this.setScreenManager()
    this.setCameraDirector()
    this.setIntro()
    this.setNDSPlayer()
    this.setInputRouter()
  }

  setEnvironment() {
    this.environment = new Environment()
  }

  setStage() {
    this.stage = new Stage({
      surfaceY: this.product.getStageSurfaceWorldY(),
      textures: {
        color: this.resources.items.stagePlasticColor,
        normal: this.resources.items.stagePlasticNormal,
        roughness: this.resources.items.stagePlasticRoughness,
      },
    })
  }

  setProduct() {
    const gltf = this.resources.items.iphoneModel

    if (!gltf?.scene) {
      throw new Error('iphoneModel 未返回有效的 GLTF Scene。')
    }

    this.product = new ModelAdapter(gltf.scene)
  }

  setControllerFeedback() {
    this.controllerFeedback = new ControllerFeedback({
      buttons: this.product.buttons,
      shell: this.product.nodes.controllerShell,
      debug: this.debug,
      onHaptic: effect => this.inputRouter?.rumble(effect),
    })
  }

  setCameraDirector() {
    this.cameraDirector = new CameraDirector()
  }

  setScreenManager() {
    this.screenManager = new ScreenManager({
      topScreen: this.product.nodes.topScreen,
      bottomScreen: this.product.nodes.bottomScreen,
      bottomDisplay: this.product.nodes.bottomDisplay,
      phoneHomeTexture: this.resources.items.phoneHomeTexture,
      gameHomeTexture: this.resources.items.gameHomeTexture,
      onPreviewAngle: angle => this.product.productRig.setDebugAngle(angle),
      onDebugModeChange: mode => this.setProductMode(mode),
    })
  }

  setIntro() {
    this.intro = new IntroDirector({
      productRig: this.product.productRig,
      onProductModeChange: mode => this.setProductMode(mode),
      onScreenWakeProgress: progress => this.screenManager.setPhoneWakeProgress(progress),
      onGameChangerStart: onComplete => this.screenManager.playGameChangerTransition({ onComplete }),
      onGameChangerStop: () => this.screenManager.killGameChangerTransition(),
      onGameChangerComplete: () => this.screenManager.completeGameChangerTransition(),
    })
  }

  setInputRouter() {
    this.inputRouter = new InputRouter({
      camera: this.experience.camera.instance,
      canvas: this.experience.canvas,
      interactionSurface: this.product.nodes.bottomDisplay,
      resolvePointerAction: uv => this.screenManager.getActionAtUv(uv),
      resolvePointerTouch: uv => this.screenManager.getNDSTouchAtUv(uv),
      onGameButtons: (actions) => {
        this.ndsPlayer.setButtons(actions)
        this.controllerFeedback.setActions(actions)
      },
      onGameTouch: point => this.ndsPlayer.touch(point),
      onAction: (action, options) => this.handleAction(action, options),
    })
  }

  setNDSPlayer() {
    this.ndsPlayer = new NDSPlayer({
      state: this.state,
      events: this.events,
      onFrame: pixels => this.screenManager.drawNDSFrame(pixels),
      onGameInfo: info => this.screenManager.setGameInfo(info),
      onEnter: () => {
        this.intro.complete()
        this.setProductMode('playing')
      },
      onExit: () => this.setProductMode('game-home'),
      onFocus: () => this.experience.canvas.focus({ preventScroll: true }),
    })
  }

  setProductMode(mode) {
    if (this.state.productMode === mode) return

    this.state.setProductMode(mode)
    this.ndsPlayer?.setMode(mode)
    this.inputRouter?.setMode(mode)
    this.screenManager.setMode(mode)
    this.events.emit('product:mode', { mode })
  }

  handleAction(action, options) {
    if (action === 'continue' && this.state.productMode === 'game-home') {
      return this.ndsPlayer.play(null, options)
    }
    else if (action === 'back' || action === 'suspend') {
      this.ndsPlayer.back()
    }
  }

  start() {
    this.intro.play()
  }

  update() {
    this.product.update()
    this.inputRouter.update()
    this.controllerFeedback.update(this.experience.time.delta)
    // Time.delta 是秒，模拟器使用毫秒；由 Experience 唯一循环驱动，不能另起 rAF。
    this.ndsPlayer.update(this.experience.time.delta * 1000)
    this.screenManager.setProductAngle(this.product.productRig.params.productAngle)
    this.screenManager.update()
    this.environment.update()
  }

  destroy() {
    this.inputRouter?.destroy()
    this.ndsPlayer?.destroy()
    this.intro?.destroy()
    this.cameraDirector?.destroy()
    this.screenManager?.destroy()
    this.stage?.destroy()
    this.controllerFeedback?.destroy()
    this.product?.destroy()
    this.environment?.destroy()
  }
}
