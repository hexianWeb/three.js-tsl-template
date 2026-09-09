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

function createFireflyData(origin) {
  const random = createRandom()
  const positions = new Float32Array(MAX_FIREFLIES * 3)
  const phases = new Float32Array(MAX_FIREFLIES)
  const scales = new Float32Array(MAX_FIREFLIES)
  const amplitudes = new Float32Array(MAX_FIREFLIES)

  for (let index = 0; index < MAX_FIREFLIES; index += 1) {
    const offset = index * 3
    if (index % 10 < 7) {
      const angle = random() * Math.PI * 2
      const radius = range(random, 0.65, 1.35)
      positions[offset] = origin.x + Math.cos(angle) * radius
      positions[offset + 1] = origin.y + Math.sin(angle) * radius * 0.75 + 0.25
      positions[offset + 2] = origin.z + range(random, -0.25, 0.45)
    } else {
      positions[offset] = range(random, -1.15, 1.15)
      positions[offset + 1] = range(random, 0.35, 1.35)
      positions[offset + 2] = range(random, -0.9, 1.45)
    }
    phases[index] = random() * Math.PI * 2
    scales[index] = range(random, 0.65, 1.35)
    amplitudes[index] = range(random, 0.05, 0.16)
  }

  return { positions, phases, scales, amplitudes }
}

export function createFireflies({ scene, params, origin }) {
  const data = createFireflyData(origin)
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
  const softDisc = smoothstep(0.08, 0.5, radialDistance).oneMinus()

  const material = new THREE.PointsNodeMaterial()
  material.name = 'fireflies'
  material.positionNode = basePosition.add(drift)
  material.sizeNode = uSize.mul(scale).mul(pulse.mul(0.25).add(0.75))
  material.colorNode = color('#ffd76a').mul(pulse)
  material.opacityNode = softDisc.mul(uVisibility)
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
      uVisibility.value = 1 - daylight * 0.8
      uSize.value = params.fireflySize
      fireflies.count = Math.min(Math.max(Math.round(params.fireflyCount), 0), MAX_FIREFLIES)
    },
  }
}
