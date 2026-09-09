import * as THREE from 'three/webgpu'
import {
  color,
  distance,
  instancedBufferAttribute,
  oscSine,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl'

const MAX_FIREFLIES = 80

function createRandom(seed = 1729) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function range(random, min, max) {
  return min + (max - min) * random()
}

export function createFireflyData(bounds) {
  const random = createRandom()
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const height = Math.max(size.y, 1.5)
  const positions = new Float32Array(MAX_FIREFLIES * 3)
  const phases = new Float32Array(MAX_FIREFLIES)
  const scales = new Float32Array(MAX_FIREFLIES)
  const amplitudes = new Float32Array(MAX_FIREFLIES)

  for (let index = 0; index < MAX_FIREFLIES; index += 1) {
    const offset = index * 3
    positions[offset] = center.x + range(random, -0.43, 0.43) * size.x
    positions[offset + 1] = bounds.min.y + range(random, 0.55, 1.25) * height
    positions[offset + 2] = center.z + range(random, -0.43, 0.43) * size.z
    phases[index] = random() * Math.PI * 2
    scales[index] = range(random, 0.65, 1.35)
    amplitudes[index] = range(random, 0.08, 0.16) * height
  }

  return { positions, phases, scales, amplitudes }
}

export function createFireflies({ scene, params, bounds }) {
  const data = createFireflyData(bounds)
  const basePosition = instancedBufferAttribute(data.positions, 'vec3')
  const phase = instancedBufferAttribute(data.phases, 'float')
  const scale = instancedBufferAttribute(data.scales, 'float')
  const amplitude = instancedBufferAttribute(data.amplitudes, 'float')
  const uSize = uniform(params.fireflySize)
  const uVisibility = uniform(1)

  const motionTime = time.mul(0.55).add(phase)
  const drift = vec3(
    motionTime.mul(0.83).sin(),
    motionTime.mul(1.17).sin(),
    motionTime.mul(0.71).cos(),
  ).mul(amplitude)
  const pulse = oscSine(time.mul(0.45).add(phase)).mul(0.35).add(0.65)
  const radialDistance = distance(uv(), vec2(0.5))
  const halo = smoothstep(0, 0.5, radialDistance).oneMinus().pow(2)
  const core = smoothstep(0.02, 0.13, radialDistance).oneMinus()

  // World-space billboard size stays intuitive across viewport resolutions.
  const material = new THREE.SpriteNodeMaterial()
  material.name = 'fireflies'
  material.positionNode = basePosition.add(drift)
  material.scaleNode = uSize.mul(scale).mul(pulse.mul(0.25).add(0.75))
  material.colorNode = color('#ffe6a3').mul(pulse).mul(2.5)
  material.opacityNode = halo.mul(0.65).add(core.mul(0.7)).clamp(0, 1).mul(uVisibility)
  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending

  const fireflies = new THREE.Sprite(material)
  fireflies.name = 'Fireflies'
  fireflies.count = Math.min(params.fireflyCount, MAX_FIREFLIES)
  fireflies.frustumCulled = false
  scene.add(fireflies)

  return {
    object: fireflies,
    sync() {
      const angle = (params.dayNightTime - 0.25) * Math.PI * 2
      const daylight = Math.max(0, Math.sin(angle))
      uVisibility.value = params.caseName === 'B' ? 1 - daylight * 0.45 : 1
      uSize.value = params.fireflySize
      fireflies.count = Math.min(Math.max(Math.round(params.fireflyCount), 0), MAX_FIREFLIES)
    },
  }
}
