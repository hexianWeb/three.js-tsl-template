import * as THREE from 'three/webgpu'
import Experience from '../Experience.js'
import ModelAdapter from './ModelAdapter.js'

export default class World {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.resources = this.experience.resources

    this.setEnvironment()
    this.setProduct()
  }

  setEnvironment() {
    this.scene.background = new THREE.Color('#090d14')

    this.hemisphereLight = new THREE.HemisphereLight('#f7fbff', '#101827', 2.4)
    this.scene.add(this.hemisphereLight)

    this.keyLight = new THREE.DirectionalLight('#ffffff', 5)
    this.keyLight.position.set(4, 6, 5)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(2048, 2048)
    this.scene.add(this.keyLight)

    this.fillLight = new THREE.DirectionalLight('#7dd3fc', 2)
    this.fillLight.position.set(-4, 1.5, 3)
    this.scene.add(this.fillLight)
  }

  setProduct() {
    const gltf = this.resources.items.iphoneModel

    if (!gltf?.scene) {
      throw new Error('iphoneModel 未返回有效的 GLTF Scene。')
    }

    this.product = new ModelAdapter(gltf.scene)
  }

  destroy() {
    this.product?.destroy()
    this.scene.remove(this.hemisphereLight, this.keyLight, this.fillLight)
    this.keyLight?.shadow?.map?.dispose()
  }
}
