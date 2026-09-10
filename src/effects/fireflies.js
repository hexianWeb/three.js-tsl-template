import * as THREE from 'three/webgpu'
import {
  color,
  float,
  Fn,
  instancedBufferAttribute,
  time,
  uv,
  vec2,
} from 'three/tsl'

export const fireflyParams = {
  count: 30,
  size: 0.12,
  amplitude: 0.2,
  color: '#ffe89a',
}

export function createFireflies({ scene, params = fireflyParams }) {
  const positions = new Float32Array(params.count * 3)
  const scales = new Float32Array(params.count)

  for (let index = 0; index < params.count; index += 1) {
    const positionOffset = index * 3
    positions[positionOffset] = (Math.random() - 0.5) * 4
    positions[positionOffset + 1] = Math.random() * 1.5
    positions[positionOffset + 2] = (Math.random() - 0.5) * 4
    scales[index] = Math.random()
  }

  const positionAttribute = new THREE.InstancedBufferAttribute(positions, 3)
  const scaleAttribute = new THREE.InstancedBufferAttribute(scales, 1)
  const instancePosition = instancedBufferAttribute(positionAttribute)
  const instanceScale = instancedBufferAttribute(scaleAttribute)

  const material = new THREE.SpriteNodeMaterial()
  material.name = 'fireflies'
  material.positionNode = Fn(() => {
    const position = instancePosition.toVar()
    const offsetY = time
      .add(instancePosition.x.mul(100))
      .sin()
      .mul(instanceScale)
      .mul(params.amplitude)

    position.y.addAssign(offsetY)
    return position
  })()
  material.scaleNode = vec2(float(params.size).mul(instanceScale))

  const centeredUv = uv().sub(0.5)
  const distanceToCenter = centeredUv.length()
  const strength = float(0.05).div(distanceToCenter).sub(0.1).max(0)
  material.colorNode = color(params.color)
  material.opacityNode = strength
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  material.depthTest = true

  const geometry = new THREE.PlaneGeometry(1, 1)
  const fireflies = new THREE.InstancedMesh(geometry, material, params.count)
  fireflies.name = 'Fireflies'
  fireflies.frustumCulled = false
  scene.add(fireflies)
  return fireflies
}
