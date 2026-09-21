import * as THREE from 'three/webgpu'
import Experience from '../../Experience.js'
import ModelInspector from './ModelInspector.js'
import ProductRig from './ProductRig.js'

const REQUIRED_NODES = {
  phoneRoot: 'PHONE_ROOT',
  bottomHalf: 'BottomHalf_NO_CAM',
  topHalf: 'TopHalf_CAM',
  hinge: 'Hinge',
  controllerAssembly: 'CONTROLLER_ASSEMBLY_ROOT',
  controllerRoot: 'Controller_ROOT',
  controllerShell: 'Controller_Shell',
  topScreen: 'Top_Screen_Plane',
  bottomScreen: 'Bottom_Screen_Plane',
  bottomDisplay: 'Bottom_Display_Plane',
}

export default class ModelAdapter {
  constructor(model) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug
    this.resources = this.experience.resources
    this.model = model
    this.resolveNodes()
    this.configureMeshes()
    this.configureControllerLightmap()

    this.presentationRoot = new THREE.Group()
    this.presentationRoot.name = 'PresentationRoot'
    this.productRig = new ProductRig({
      model: this.model,
      nodes: this.nodes,
    })
    this.presentationRoot.add(this.productRig.productRoot)

    this.fitModel()
    this.productRig.applyInitialPose()
    this.scene.add(this.presentationRoot)
    this.debugInit()
    this.inspector = new ModelInspector({
      presentationRoot: this.presentationRoot,
      nodes: {
        ...this.nodes,
        ...this.productRig.getInspectableNodes(),
      },
    })
  }

  resolveNodes() {
    this.nodes = {}
    const missingNodes = []

    Object.entries(REQUIRED_NODES).forEach(([key, nodeName]) => {
      const node = this.model.getObjectByName(nodeName)

      if (node) {
        this.nodes[key] = node
      }
      else {
        missingNodes.push(nodeName)
      }
    })

    if (missingNodes.length > 0) {
      throw new Error(`GLB 缺少必要节点：${missingNodes.join('、')}`)
    }
  }

  configureMeshes() {
    this.meshes = []

    this.model.traverse((child) => {
      if (!child.isMesh) return

      child.castShadow = true
      child.receiveShadow = true
      this.meshes.push(child)
    })
  }

  configureControllerLightmap() {
    this.controllerShellLightmap = this.resources.items.controllerShellLightmap
    const controllerShell = this.nodes.controllerShell

    if (!this.controllerShellLightmap?.isTexture) {
      throw new Error('controllerShellLightmap 未返回有效纹理。')
    }
    if (!controllerShell.isMesh || !controllerShell.geometry.attributes.uv1) {
      throw new Error('Controller_Shell 缺少 Lightmap UV（TEXCOORD_1 / uv1）。')
    }

    // bake 写在 Blender 的 Lightmap 层，导出为 TEXCOORD_1；Three.js 对应 uv1 / channel 1。
    // 当前 EXR 与 glTF UV 的 V 方向相反，视觉校验确认需要 flipY 才能正确对齐。
    this.controllerShellLightmap.name = 'Controller_Shell_Lightmap'
    this.controllerShellLightmap.colorSpace = THREE.LinearSRGBColorSpace
    this.controllerShellLightmap.flipY = true
    this.controllerShellLightmap.channel = 1
    this.controllerShellLightmap.needsUpdate = true
    this.controllerShellMaterials = Array.isArray(controllerShell.material)
      ? controllerShell.material
      : [controllerShell.material]

    this.controllerShellMaterials.forEach((material) => {
      material.lightMap = this.controllerShellLightmap
      material.lightMapIntensity = 1
      material.needsUpdate = true
    })
  }

  fitModel() {
    this.productRig.productRoot.updateMatrixWorld(true)

    const bounds = new THREE.Box3().setFromObject(this.productRig.productRoot)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z)

    if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
      throw new Error('无法从 iPhone GLB 计算有效包围盒。')
    }

    // ProductRoot 统一承担居中偏移，避免修改 GLB 节点及运行时 Rig 的相对变换。
    this.productRig.productRoot.position.sub(center)
    this.fitScale = 3.2 / maxDimension
    this.params = {
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: this.fitScale,
      wireframe: false,
      controllerLightmapEnabled: true,
      controllerLightmapIntensity: 1,
      nodeStatus: `${Object.keys(this.nodes).length} / ${Object.keys(REQUIRED_NODES).length}`,
    }

    this.applyTransform()
    this.applyControllerLightmap()
  }

  applyTransform() {
    this.presentationRoot.position.set(
      this.params.positionX,
      this.params.positionY,
      this.params.positionZ,
    )
    this.presentationRoot.rotation.set(
      THREE.MathUtils.degToRad(this.params.rotationX),
      THREE.MathUtils.degToRad(this.params.rotationY),
      THREE.MathUtils.degToRad(this.params.rotationZ),
    )
    this.presentationRoot.scale.setScalar(this.params.scale)
  }

  setWireframe(enabled) {
    this.meshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((material) => {
        material.wireframe = enabled
        material.needsUpdate = true
      })
    })
  }

  applyControllerLightmap() {
    this.controllerShellMaterials.forEach((material) => {
      material.lightMap = this.params.controllerLightmapEnabled
        ? this.controllerShellLightmap
        : null
      material.lightMapIntensity = this.params.controllerLightmapIntensity
      material.needsUpdate = true
    })
  }

  debugInit() {
    const folder = this.debug.ui.addFolder({ title: 'Product Model', expanded: false })
    folder.addBinding(this.params, 'nodeStatus', {
      label: 'Required nodes',
      readonly: true,
    })

    const lightmapFolder = folder.addFolder({ title: 'Controller Lightmap' })
    lightmapFolder.addBinding(this.params, 'controllerLightmapEnabled', {
      label: 'Enabled',
    }).on('change', () => this.applyControllerLightmap())
    lightmapFolder.addBinding(this.params, 'controllerLightmapIntensity', {
      label: 'Intensity',
      min: 0,
      max: 5,
      step: 0.05,
    }).on('change', () => this.applyControllerLightmap())

    const transformFolder = folder.addFolder({ title: 'Transform' })
    const positionKeys = ['positionX', 'positionY', 'positionZ']
    const rotationKeys = ['rotationX', 'rotationY', 'rotationZ']

    positionKeys.forEach((key) => {
      transformFolder.addBinding(this.params, key, {
        label: key,
        min: -3,
        max: 3,
        step: 0.01,
      }).on('change', () => this.applyTransform())
    })
    rotationKeys.forEach((key) => {
      transformFolder.addBinding(this.params, key, {
        label: key,
        min: -180,
        max: 180,
        step: 1,
      }).on('change', () => this.applyTransform())
    })
    transformFolder.addBinding(this.params, 'scale', {
      label: 'scale',
      min: this.fitScale * 0.25,
      max: this.fitScale * 3,
      step: this.fitScale * 0.01,
    }).on('change', () => this.applyTransform())

    folder.addBinding(this.params, 'wireframe', {
      label: 'Wireframe',
    }).on('change', ({ value }) => this.setWireframe(value))
  }

  update() {
    this.inspector.update()
  }

  destroy() {
    this.inspector?.destroy()
    this.productRig?.destroy()
    const geometries = new Set()
    const materials = new Set()
    const textures = new Set()

    this.meshes.forEach((mesh) => {
      geometries.add(mesh.geometry)
      const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      meshMaterials.forEach((material) => {
        materials.add(material)
        Object.values(material).forEach((value) => {
          if (value?.isTexture) textures.add(value)
        })
      })
    })

    textures.add(this.controllerShellLightmap)
    textures.forEach(texture => texture.dispose())
    materials.forEach(material => material.dispose())
    geometries.forEach(geometry => geometry.dispose())
    this.scene.remove(this.presentationRoot)
  }
}
