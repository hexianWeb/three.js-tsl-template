import * as THREE from 'three/webgpu'
import Experience from '../Experience.js'
import ControllerAssembly from './ControllerAssembly.js'

const BIND_ANGLE = 180
const DEFAULT_FOLDED_ANGLE = 8
const DEFAULT_PLAY_ANGLE = 110
const DEFAULT_HINGE_AXIS_SIGN = 1

export default class ProductRig {
  constructor({ model, nodes }) {
    this.experience = new Experience()
    this.debug = this.experience.debug
    this.model = model
    this.nodes = nodes
    this.rotationQuaternion = new THREE.Quaternion()

    this.setHierarchy()
    this.setHingeFrame()
    this.attachProductParts()
    this.setParams()
    this.debugInit()
    this.setControllerAssembly()
  }

  setHierarchy() {
    this.productRoot = new THREE.Group()
    this.productRoot.name = 'ProductRoot'
    this.productRoot.add(this.model)

    this.bottomRig = new THREE.Group()
    this.bottomRig.name = 'BottomRig'
    this.hingePivot = new THREE.Group()
    this.hingePivot.name = 'HingePivot'
    this.hingeVisualRig = new THREE.Group()
    this.hingeVisualRig.name = 'HingeVisualRig'
    this.runtimeAnchors = new THREE.Group()
    this.runtimeAnchors.name = 'RuntimeAnchors'

    this.productRoot.add(
      this.bottomRig,
      this.hingePivot,
      this.hingeVisualRig,
      this.runtimeAnchors,
    )
  }

  setHingeFrame() {
    const hingeBounds = this.getLocalBounds(this.nodes.hinge)
    const hingeCenter = hingeBounds.getCenter(new THREE.Vector3())
    const hingeSize = hingeBounds.getSize(new THREE.Vector3())
    const axisName = ['x', 'y', 'z'].reduce(
      (longest, axis) => hingeSize[axis] > hingeSize[longest] ? axis : longest,
      'x',
    )

    this.hingeAxis = new THREE.Vector3(
      axisName === 'x' ? 1 : 0,
      axisName === 'y' ? 1 : 0,
      axisName === 'z' ? 1 : 0,
    )
    this.hingeAxisName = axisName.toUpperCase()

    this.productRoot.updateMatrixWorld(true)
    const hingeCenterWorld = this.nodes.hinge.localToWorld(hingeCenter.clone())
    const productWorldQuaternion = this.productRoot.getWorldQuaternion(new THREE.Quaternion())
    const hingeWorldQuaternion = this.nodes.hinge.getWorldQuaternion(new THREE.Quaternion())

    // Pivot 使用 Hinge 的局部坐标系，使包围盒推导出的长轴可直接作为旋转轴。
    const hingeLocalQuaternion = productWorldQuaternion.invert().multiply(hingeWorldQuaternion)
    const hingeCenterInProduct = this.productRoot.worldToLocal(hingeCenterWorld)
    const hingeRigs = [this.hingePivot, this.hingeVisualRig]
    hingeRigs.forEach((rig) => {
      rig.position.copy(hingeCenterInProduct)
      rig.quaternion.copy(hingeLocalQuaternion)
    })
  }

  getLocalBounds(object) {
    object.updateWorldMatrix(true, true)
    const inverseObjectMatrix = object.matrixWorld.clone().invert()
    const localBounds = new THREE.Box3().makeEmpty()

    object.traverse((child) => {
      if (!child.isMesh || !child.geometry) return

      child.geometry.computeBoundingBox()
      if (!child.geometry.boundingBox) return

      // 将每个子 Mesh 的包围盒变换回 Hinge 局部空间，避免依赖 Blender 世界轴。
      const childToObjectMatrix = inverseObjectMatrix.clone().multiply(child.matrixWorld)
      const childBounds = child.geometry.boundingBox.clone().applyMatrix4(childToObjectMatrix)
      localBounds.union(childBounds)
    })

    if (localBounds.isEmpty()) {
      throw new Error('无法从 Hinge 节点推导有效包围盒。')
    }

    return localBounds
  }

  attachProductParts() {
    this.productRoot.updateMatrixWorld(true)

    // attach 在更换父级时保持世界变换；当前 GLB 父级均为均匀缩放。
    this.bottomRig.attach(this.nodes.bottomHalf)
    this.bottomRig.attach(this.nodes.controllerAssembly)
    this.hingePivot.attach(this.nodes.topHalf)
    this.hingeVisualRig.attach(this.nodes.hinge)
    this.productRoot.updateMatrixWorld(true)

    this.hingeBindQuaternion = this.hingePivot.quaternion.clone()
    this.hingeVisualBindQuaternion = this.hingeVisualRig.quaternion.clone()
    this.nodes.controllerAssembly.updateMatrix()
    this.controllerInstalledMatrix = this.nodes.controllerAssembly.matrix.clone()
  }

  setParams() {
    this.params = {
      productAngle: DEFAULT_FOLDED_ANGLE,
      foldedAngle: DEFAULT_FOLDED_ANGLE,
      playAngle: DEFAULT_PLAY_ANGLE,
      hingeAxis: this.hingeAxisName,
      hingeAxisSign: DEFAULT_HINGE_AXIS_SIGN,
      hingeVisualMix: 0.5,
    }
  }

  setProductAngle(angle) {
    this.params.productAngle = THREE.MathUtils.clamp(angle, 0, BIND_ANGLE)
    const foldRotation = THREE.MathUtils.degToRad(BIND_ANGLE - this.params.productAngle)
    const signedRotation = this.params.hingeAxisSign * foldRotation

    this.rotationQuaternion.setFromAxisAngle(this.hingeAxis, signedRotation)
    this.hingePivot.quaternion
      .copy(this.hingeBindQuaternion)
      .multiply(this.rotationQuaternion)

    this.rotationQuaternion.setFromAxisAngle(
      this.hingeAxis,
      signedRotation * this.params.hingeVisualMix,
    )
    this.hingeVisualRig.quaternion
      .copy(this.hingeVisualBindQuaternion)
      .multiply(this.rotationQuaternion)
  }

  applyInitialPose() {
    this.setProductAngle(this.params.foldedAngle)
  }

  setControllerAssembly() {
    this.controllerAssembly = new ControllerAssembly({
      controller: this.nodes.controllerAssembly,
      bottomRig: this.bottomRig,
      installedMatrix: this.controllerInstalledMatrix,
      prepareAssembly: () => this.setDebugAngle(this.params.playAngle),
    })
  }

  debugInit() {
    const folder = this.debug.ui.addFolder({ title: 'Product Rig' })
    folder.addBinding(this.params, 'hingeAxis', {
      label: 'Hinge axis',
      readonly: true,
    })
    this.productAngleBinding = folder.addBinding(this.params, 'productAngle', {
      label: 'Product angle',
      min: 0,
      max: BIND_ANGLE,
      step: 1,
    }).on('change', ({ value }) => this.setProductAngle(value))
    folder.addBinding(this.params, 'hingeAxisSign', {
      label: 'Axis sign',
      options: {
        Positive: 1,
        Negative: -1,
      },
    }).on('change', () => this.setProductAngle(this.params.productAngle))
    folder.addBinding(this.params, 'hingeVisualMix', {
      label: 'Hinge visual mix',
      min: 0,
      max: 1,
      step: 0.05,
    }).on('change', () => this.setProductAngle(this.params.productAngle))

    const poses = folder.addFolder({ title: 'Pose checks' })
    poses.addButton({ title: 'Folded 8°' })
      .on('click', () => this.setDebugAngle(this.params.foldedAngle))
    poses.addButton({ title: 'Hero 110°' })
      .on('click', () => this.setDebugAngle(this.params.playAngle))
    poses.addButton({ title: 'Bind 180°' }).on('click', () => this.setDebugAngle(BIND_ANGLE))
  }

  setDebugAngle(angle) {
    this.setProductAngle(angle)
    this.productAngleBinding.refresh()
  }

  getInspectableNodes() {
    return {
      productRoot: this.productRoot,
      bottomRig: this.bottomRig,
      hingePivot: this.hingePivot,
      hingeVisualRig: this.hingeVisualRig,
      runtimeAnchors: this.runtimeAnchors,
    }
  }

  destroy() {
    this.controllerAssembly?.destroy()
  }
}
