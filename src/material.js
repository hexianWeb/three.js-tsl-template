import { mix, oscSine, time, uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

/**
 * Torus MeshStandardNodeMaterial.
 * colorNode is the TSL output — edit this graph to change the look.
 */
export function createTorusMaterial() {
  const uBaseColor = uniform(new THREE.Color('#4cc9f0'))
  const uAccentColor = uniform(new THREE.Color('#f72585'))
  const uSpeed = uniform(0.6)

  const material = new THREE.MeshStandardNodeMaterial()
  material.roughness = 0.35
  material.metalness = 0.15
  material.colorNode = mix(
    uBaseColor,
    uAccentColor,
    oscSine(time.mul(uSpeed)).mul(0.5).add(0.5),
  )

  return {
    material,
    uniforms: { uBaseColor, uAccentColor, uSpeed },
  }
}
