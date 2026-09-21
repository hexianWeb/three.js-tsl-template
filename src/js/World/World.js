import * as THREE from 'three/webgpu'
import Experience from '../Experience.js'
import CameraDirector from './Directors/CameraDirector.js'
import IntroDirector from './Directors/IntroDirector.js'
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
    this.params = {
      shadowBias: 0,
      shadowNormalBias: 0.006,
      showKeyLightHelper: true,
    }

    this.setEnvironment()
    this.setProduct()
    this.setScreenManager()
    this.setCameraDirector()
    this.setIntro()
    this.setInputRouter()
    this.debugInit()
  }

  setEnvironment() {
    this.scene.background = new THREE.Color('#090d14')

    this.hemisphereLight = new THREE.HemisphereLight('#f7fbff', '#101827', 2.4)
    this.scene.add(this.hemisphereLight)

    this.keyLight = new THREE.DirectionalLight('#ffffff', 5)
    this.keyLight.position.set(4, 6, 5)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(2048, 2048)
    this.applyShadowSettings()
    this.scene.add(this.keyLight)

    this.keyLightHelper = new THREE.DirectionalLightHelper(this.keyLight, 0.5, '#fbbf24')
    this.keyLightHelper.visible = this.params.showKeyLightHelper
    this.scene.add(this.keyLightHelper)

    this.fillLight = new THREE.DirectionalLight('#7dd3fc', 2)
    this.fillLight.position.set(-4, 1.5, 3)
    this.scene.add(this.fillLight)
  }

  applyShadowSettings() {
    this.keyLight.shadow.bias = this.params.shadowBias
    this.keyLight.shadow.normalBias = this.params.shadowNormalBias
  }

  debugInit() {
    const folder = this.debug.ui.addFolder({ title: 'Lighting', expanded: false })
    folder.addBinding(this.params, 'shadowBias', {
      label: 'Shadow bias',
      min: -0.01,
      max: 0.01,
      step: 0.0001,
    }).on('change', () => this.applyShadowSettings())
    folder.addBinding(this.params, 'shadowNormalBias', {
      label: 'Shadow normal bias',
      min: 0,
      max: 0.2,
      step: 0.001,
    }).on('change', () => this.applyShadowSettings())
    folder.addBinding(this.params, 'showKeyLightHelper', {
      label: 'Key light helper',
    }).on('change', ({ value }) => {
      this.keyLightHelper.visible = value
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
    this.keyLightHelper.update()
  }

  destroy() {
    this.inputRouter?.destroy()
    this.intro?.destroy()
    this.cameraDirector?.destroy()
    this.screenManager?.destroy()
    this.product?.destroy()
    this.scene.remove(this.hemisphereLight, this.keyLight, this.keyLightHelper, this.fillLight)
    this.keyLightHelper?.dispose()
    this.keyLight?.shadow?.map?.dispose()
  }
}
