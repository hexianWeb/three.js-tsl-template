import * as THREE from 'three/webgpu'

export const REFERENCE_LIGHT = Object.freeze({
  color: 0xffc08a,
  intensity: 2.5,
  position: Object.freeze([-5.16, 4.08, 4.58]),
})

export function createLightingRig() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#000000')

  const directionalLight = new THREE.DirectionalLight(
    REFERENCE_LIGHT.color,
    REFERENCE_LIGHT.intensity,
  )
  directionalLight.position.fromArray(REFERENCE_LIGHT.position)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.set(4096, 4096)
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 30
  directionalLight.shadow.camera.left = -10
  directionalLight.shadow.camera.right = 10
  directionalLight.shadow.camera.top = 10
  directionalLight.shadow.camera.bottom = -10
  directionalLight.shadow.normalBias = 0.02
  scene.add(directionalLight, directionalLight.target)

  return { scene, directionalLight }
}
