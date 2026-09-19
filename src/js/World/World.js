import * as THREE from 'three/webgpu'
import Experience from '../Experience.js'
import IntroDirector from './IntroDirector.js'
import ModelAdapter from './ModelAdapter.js'

export default class World {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.resources = this.experience.resources
    this.debug = this.experience.debug
    this.params = {
      shadowBias: 0,
      shadowNormalBias: 0.006,
      showKeyLightHelper: true,
    }

    this.setEnvironment()
    this.setProduct()
    this.setIntro()
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

  setIntro() {
    this.intro = new IntroDirector({
      productRig: this.product.productRig,
    })
  }

  start() {
    this.intro.play()
  }

  update() {
    this.product.update()
    this.keyLightHelper.update()
  }

  destroy() {
    this.intro?.destroy()
    this.product?.destroy()
    this.scene.remove(this.hemisphereLight, this.keyLight, this.keyLightHelper, this.fillLight)
    this.keyLightHelper?.dispose()
    this.keyLight?.shadow?.map?.dispose()
  }
}
