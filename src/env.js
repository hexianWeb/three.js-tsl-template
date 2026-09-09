import * as THREE from 'three/webgpu'

export function createEnv() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#111111')

  const directionalLight = new THREE.DirectionalLight(0xffc08a, 2.5)
  directionalLight.position.set(-5.16, 4.08, 4.58)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.set(4096, 4096)
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 30
  directionalLight.shadow.camera.left = -10
  directionalLight.shadow.camera.right = 10
  directionalLight.shadow.camera.top = 10
  directionalLight.shadow.camera.bottom = -10
  directionalLight.shadow.normalBias = 0.02
  scene.add(directionalLight)
  scene.add(directionalLight.target)

  return { scene, directionalLight }
}
