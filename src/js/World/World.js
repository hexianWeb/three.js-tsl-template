import Experience from '../Experience.js'
import CameraDirector from './Directors/CameraDirector.js'
import IntroDirector from './Directors/IntroDirector.js'
import Environment from './Environment/Environment.js'
import Stage from './Environment/Stage.js'
import InputRouter from './Input/InputRouter.js'
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
    this.setStage()
    this.setScreenManager()
    this.setCameraDirector()
    this.setIntro()
    this.setInputRouter()
  }

  setEnvironment() {
    this.environment = new Environment()
  }

  setStage() {
    this.stage = new Stage({
      surfaceY: this.product.getStageSurfaceWorldY(),
    })
  }

  setProduct() {
    const gltf = this.resources.items.iphoneModel

    if (!gltf?.scene) {
      throw new Error('iphoneModel 未返回有效的 GLTF Scene。')
    }

    this.product = new ModelAdapter(gltf.scene)
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
      onAction: action => this.handleAction(action),
    })
  }

  setProductMode(mode) {
    if (this.state.productMode === mode) return

    this.state.setProductMode(mode)
    this.screenManager.setMode(mode)
    this.events.emit('product:mode', { mode })
  }

  handleAction(action) {
    if (action === 'continue' && this.state.productMode === 'game-home') {
      this.intro.complete()
      this.setProductMode('playing')
    }
    else if (action === 'back' && this.state.productMode === 'playing') {
      this.setProductMode('game-home')
    }
  }

  start() {
    this.intro.play()
  }

  update() {
    this.product.update()
    this.screenManager.setProductAngle(this.product.productRig.params.productAngle)
    this.screenManager.update()
    this.inputRouter.update()
    this.environment.update()
  }

  destroy() {
    this.inputRouter?.destroy()
    this.intro?.destroy()
    this.cameraDirector?.destroy()
    this.screenManager?.destroy()
    this.stage?.destroy()
    this.product?.destroy()
    this.environment?.destroy()
  }
}
