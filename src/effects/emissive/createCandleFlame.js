import * as THREE from 'three/webgpu'
import {
  color,
  float,
  smoothstep,
  uniform,
  uv,
} from 'three/tsl'

const INNER_COLOR = color('#fff2b0')
const PHASES = [0.73, 3.91]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function calculateCandleFlicker(elapsedSeconds, phase = 0) {
  const fast = Math.sin(elapsedSeconds * 11.7 + phase)
  const medium = Math.sin(elapsedSeconds * 5.3 + phase * 1.7)
  const slow = Math.sin(elapsedSeconds * 1.9 + phase * 0.73)
  const irregular = fast * 0.42 + medium * 0.34 + slow * 0.24
  const dipWave = Math.sin(elapsedSeconds * 0.83 + phase * 2.1) * 0.5 + 0.5
  const dip = dipWave ** 10

  return {
    shell: clamp(1 + irregular * 0.08 - dip * 0.035, 0.9, 1.08),
    light: clamp(1 + irregular * 0.12 - dip * 0.05, 0.84, 1.12),
    stretch: clamp(1 + medium * 0.06 + slow * 0.04 - dip * 0.08, 0.86, 1.1),
    bend: fast * 0.035 + medium * 0.025,
    curl: Math.sin(elapsedSeconds * 8.7 + phase * 1.13) * 0.018 + fast * 0.006,
  }
}

export function calculateFlameDistortion(height, bend, curl) {
  const normalizedHeight = clamp(height, 0, 1)
  const upperInfluence = normalizedHeight ** 1.7
  const detail = Math.sin(normalizedHeight * Math.PI * 2) * normalizedHeight ** 2
  return bend * upperInfluence + curl * detail
}

function createFlameMaterial({
  outer,
  uPoleColor,
  uPoleIntensity,
  uBrightness,
  uBend,
  uCurl,
}) {
  const material = new THREE.SpriteNodeMaterial()
  const coordinates = uv()
  const upperInfluence = coordinates.y.pow(1.7)
  const detailInfluence = coordinates.y.pow(2)
  const layerResponse = outer ? 1 : 0.62
  const horizontalOffset = uBend
    .mul(upperInfluence)
    .add(
      coordinates.y
        .mul(Math.PI * 2)
        .sin()
        .mul(detailInfluence)
        .mul(uCurl),
    )
    .mul(layerResponse)
  const heightProfile = coordinates.y.mul(Math.PI).sin().max(0)
  const halfWidth = heightProfile.mul(outer ? 0.31 : 0.27).add(0.018)
  const horizontalDistance = coordinates.x.sub(0.5).sub(horizontalOffset).abs()
  const sides = float(1).sub(smoothstep(halfWidth.mul(0.72), halfWidth, horizontalDistance))
  const base = smoothstep(0.02, 0.13, coordinates.y)
  const tip = float(1).sub(smoothstep(0.86, 0.99, coordinates.y))
  const mask = sides.mul(base).mul(tip)

  material.name = outer ? 'candle-flame-outer' : 'candle-flame-core'
  material.colorNode = (outer ? uPoleColor : INNER_COLOR)
    .mul(uPoleIntensity)
    .mul(uBrightness)
  material.opacityNode = mask.mul(outer ? 0.82 : 0.94)
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  material.depthTest = true
  return material
}

export function createCandleFlame({ mesh, index, params, uPoleColor, uPoleIntensity }) {
  mesh.geometry.computeBoundingBox()
  const bounds = mesh.geometry.boundingBox
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const height = Math.max(size.y * 0.78, 0.08)
  const width = height * 0.48
  const baseY = center.y - size.y * 0.04 - height * 0.5
  const phase = PHASES[index % PHASES.length] + Math.floor(index / PHASES.length) * 1.37
  const uBrightness = uniform(1)
  const uBend = uniform(0)
  const uCurl = uniform(0)

  const flame = new THREE.Group()
  flame.name = `CandleFlame-${index + 1}`
  flame.position.set(center.x, center.y - size.y * 0.04, center.z)

  const outer = new THREE.Sprite(createFlameMaterial({
    outer: true,
    uPoleColor,
    uPoleIntensity,
    uBrightness,
    uBend,
    uCurl,
  }))
  outer.name = 'CandleFlameOuter'
  outer.scale.set(width, height, 1)
  outer.renderOrder = 2

  const core = new THREE.Sprite(createFlameMaterial({
    outer: false,
    uPoleColor,
    uPoleIntensity,
    uBrightness,
    uBend,
    uCurl,
  }))
  core.name = 'CandleFlameCore'
  core.position.y = -height * 0.1
  core.scale.set(width * 0.52, height * 0.64, 1)
  core.renderOrder = 3

  flame.add(outer, core)
  mesh.add(flame)

  return {
    object: flame,
    phase,
    update(elapsedSeconds) {
      const state = calculateCandleFlicker(elapsedSeconds, phase)
      const heightScale = params.poleFlameHeight ?? 1
      const widthScale = params.poleFlameWidth ?? 1
      const coreRatio = params.poleFlameCore ?? 0.55
      const animatedHeight = height * heightScale * state.stretch
      const animatedWidth = width * widthScale
      uBrightness.value = state.shell
      uBend.value = state.bend
      uCurl.value = state.curl
      flame.position.y = baseY + animatedHeight * 0.5
      outer.scale.set(animatedWidth, animatedHeight, 1)
      core.position.y = -animatedHeight * 0.1
      core.scale.set(
        animatedWidth * coreRatio,
        animatedHeight * Math.min(coreRatio + 0.12, 0.92),
        1,
      )
      return state
    },
    setVisible(visible) {
      flame.visible = visible
    },
  }
}
