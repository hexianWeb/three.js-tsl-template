import * as THREE from 'three/webgpu'
import { createControllerPlasticMaterial } from '../Product/createControllerPlasticMaterial.js'

// 只共享只读 Geometry，矩阵、材质和 uniform 全部归展示实例所有。
export default class ExhibitSample {
  constructor({ sources, width, height, rotation = 0, plasticParams = null, name }) {
    this.group = new THREE.Group()
    this.group.name = name
    this.materials = new Set()
    this.plastics = []
    this.meshes = []
    const bounds = new THREE.Box3()
    const orientation = new THREE.Matrix4().makeRotationZ(rotation)
    const transforms = sources.map(source => orientation.clone().multiply(source.matrix))
    const point = new THREE.Vector3()
    sources.forEach((source, index) => {
      const positions = source.geometry.attributes.position
      for (let i = 0; i < positions.count; i++) {
        bounds.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(transforms[index]))
      }
    })
    const size = bounds.getSize(new THREE.Vector3())
    const fitScale = Math.min(width / size.x, height / size.y)
    if (!Number.isFinite(fitScale) || fitScale <= 0) throw new Error(`${name} 缺少有效展示尺寸`)
    this.size = size.clone().multiplyScalar(fitScale)
    const center = bounds.getCenter(new THREE.Vector3())
    // 根节点的 XY 为展品中心，Z=0 为后表面，便于给展板留出悬挂间距或落到 Dock 承托面。
    const normalization = new THREE.Matrix4().makeScale(fitScale, fitScale, fitScale)
      .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -bounds.min.z))
    sources.forEach((source, index) => {
      const mesh = new THREE.Mesh(source.geometry, null)
      mesh.name = `${name}_${source.name}`
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(normalization.clone().multiply(transforms[index]))
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.group.add(mesh)
      this.meshes.push(mesh)
      if (plasticParams) {
        const plastic = createControllerPlasticMaterial(mesh, { ...plasticParams, side: source.materials[0].side })
        plastic.material.name = `${name}_Plastic`
        mesh.material = plastic.material
        this.plastics.push(plastic)
        this.materials.add(plastic.material)
      }
      else {
        const materials = source.materials.map((sourceMaterial) => {
          const material = new THREE.MeshPhysicalNodeMaterial({
            ...sourceMaterial,
            name: `${name}_Button_Plastic`,
            metalness: 0, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.12, ior: 1.47,
          })
          this.materials.add(material)
          return material
        })
        mesh.material = materials.length === 1 ? materials[0] : materials
      }
    })
  }

  setColor(value) {
    for (const plastic of this.plastics) {
      plastic.params.color = value
      plastic.uniforms.color.value.set(value)
    }
  }

  setFinish({ roughness, bumpStrength }) {
    for (const plastic of this.plastics) {
      for (const [key, value] of Object.entries({ roughness, bumpStrength })) {
        plastic.params[key] = value
        plastic.uniforms[key].value = value
      }
    }
  }

  destroy() {
    this.group.removeFromParent()
    this.materials.forEach(material => material.dispose())
    // GLB Geometry 仍由 ModelAdapter 统一回收，不能因隐藏或销毁展示件提前释放。
  }
}
