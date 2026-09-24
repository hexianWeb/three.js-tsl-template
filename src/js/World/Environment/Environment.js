import * as THREE from 'three/webgpu'
import Experience from '../../Experience.js'

// 经实测放弃 HDR 环境贴图：studio HDR 与外壳 EXR Lightmap 重复计光，整体反而更平。
// 因此场景不设置 scene.environment，间接漫反射由 HemisphereLight 承担，间接镜面为零，
// 清漆高光只来自两盏 DirectionalLight。改变这个结论前先读 docs/Scene_Lighting_Stage_Plan.md。
export default class Environment {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug
    this.renderer = this.experience.renderer

    this.params = {
      background: '#e2dfd8',
      exposure: 0.84,
      hemisphereIntensity: 3.05,
      keyIntensity: 2.4,
      keyX: 2.9,
      keyY: 6,
      keyZ: 6.8,
      fillIntensity: 1.05,
      shadowExtent: 4.0,
      shadowDepth: 6,
      shadowRadius: 10.0,
      shadowBias: 0,
      shadowNormalBias: 0.006,
      showKeyLightHelper: true,
    }

    this.setLights()
    this.renderer.setExposure(this.params.exposure)
    this.debugInit()
  }

  setLights() {
    this.scene.background = new THREE.Color(this.params.background)

    this.hemisphereLight = new THREE.HemisphereLight('#f7fbff', '#101827', this.params.hemisphereIntensity)
    this.scene.add(this.hemisphereLight)

    this.keyLight = new THREE.DirectionalLight('#ffffff', this.params.keyIntensity)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(2048, 2048)
    this.scene.add(this.keyLight)

    this.keyLightHelper = new THREE.DirectionalLightHelper(this.keyLight, 0.5, '#fbbf24')
    this.keyLightHelper.visible = this.params.showKeyLightHelper
    this.scene.add(this.keyLightHelper)

    this.fillLight = new THREE.DirectionalLight('#7dd3fc', this.params.fillIntensity)
    this.fillLight.position.set(-4, 1.5, 3)
    this.scene.add(this.fillLight)

    this.applyKeyLight()
  }

  applyKeyLight() {
    this.keyLight.position.set(this.params.keyX, this.params.keyY, this.params.keyZ)
    this.applyShadowSettings()
  }

  applyShadowSettings() {
    const { shadow } = this.keyLight
    const camera = shadow.camera
    const extent = this.params.shadowExtent
    // 主光 target 保持在原点，因此光源到取景中心的距离就是位置向量长度。
    // 以该距离为中心收紧 near/far，替代默认的 0.5–500，避免深度精度全部浪费在空区间上。
    const distance = this.keyLight.position.length()

    camera.left = -extent
    camera.right = extent
    camera.top = extent
    camera.bottom = -extent
    camera.near = Math.max(0.1, distance - this.params.shadowDepth)
    camera.far = distance + this.params.shadowDepth
    camera.updateProjectionMatrix()

    // PCFShadowMap 的软边由 radius 控制，单位是阴影贴图像素；1 接近硬边。
    shadow.radius = this.params.shadowRadius
    shadow.bias = this.params.shadowBias
    shadow.normalBias = this.params.shadowNormalBias
  }

  debugInit() {
    this.folder = this.debug.ui.addFolder({ title: 'Environment', expanded: false })

    this.folder.addBinding(this.params, 'background', { label: 'Background' })
      .on('change', ({ value }) => this.scene.background.set(value))
    this.folder.addBinding(this.params, 'exposure', {
      label: 'Exposure',
      min: 0.2,
      max: 3,
      step: 0.01,
    }).on('change', ({ value }) => this.renderer.setExposure(value))

    const lights = this.folder.addFolder({ title: 'Lights' })
    lights.addBinding(this.params, 'hemisphereIntensity', {
      label: 'Hemisphere',
      min: 0,
      max: 6,
      step: 0.05,
    }).on('change', ({ value }) => { this.hemisphereLight.intensity = value })
    lights.addBinding(this.params, 'keyIntensity', {
      label: 'Key',
      min: 0,
      max: 15,
      step: 0.1,
    }).on('change', ({ value }) => { this.keyLight.intensity = value })
    lights.addBinding(this.params, 'fillIntensity', {
      label: 'Fill',
      min: 0,
      max: 8,
      step: 0.05,
    }).on('change', ({ value }) => { this.fillLight.intensity = value })
    Object.entries({ keyX: 'Key X', keyY: 'Key Y', keyZ: 'Key Z' }).forEach(([key, label]) => {
      lights.addBinding(this.params, key, {
        label,
        min: -12,
        max: 12,
        step: 0.1,
      }).on('change', () => this.applyKeyLight())
    })
    lights.addBinding(this.params, 'showKeyLightHelper', {
      label: 'Key light helper',
    }).on('change', ({ value }) => { this.keyLightHelper.visible = value })

    const shadows = this.folder.addFolder({ title: 'Key shadow' })
    shadows.addBinding(this.params, 'shadowExtent', {
      label: 'Extent',
      min: 1,
      max: 12,
      step: 0.1,
    }).on('change', () => this.applyShadowSettings())
    shadows.addBinding(this.params, 'shadowDepth', {
      label: 'Depth range',
      min: 1,
      max: 20,
      step: 0.1,
    }).on('change', () => this.applyShadowSettings())
    shadows.addBinding(this.params, 'shadowRadius', {
      label: 'Radius',
      min: 0,
      max: 20,
      step: 0.1,
    }).on('change', () => this.applyShadowSettings())
    shadows.addBinding(this.params, 'shadowBias', {
      label: 'Bias',
      min: -0.01,
      max: 0.01,
      step: 0.0001,
    }).on('change', () => this.applyShadowSettings())
    shadows.addBinding(this.params, 'shadowNormalBias', {
      label: 'Normal bias',
      min: 0,
      max: 0.2,
      step: 0.001,
    }).on('change', () => this.applyShadowSettings())
  }

  update() {
    this.keyLightHelper.update()
  }

  destroy() {
    this.folder.dispose()
    this.scene.remove(this.hemisphereLight, this.keyLight, this.keyLightHelper, this.fillLight)
    this.keyLightHelper.dispose()
    this.keyLight.shadow.map?.dispose()
    this.hemisphereLight.dispose()
    this.keyLight.dispose()
    this.fillLight.dispose()
    this.scene.background = null
  }
}
