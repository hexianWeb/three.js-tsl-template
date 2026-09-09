import * as THREE from 'three/webgpu'
import {
  color,
  mix,
  mx_noise_float,
  oscSine,
  smoothstep,
  time,
  uniform,
  uv,
  vec3,
} from 'three/tsl'

const EDGE_COLOR = color('#264cff')
const CORE_COLOR = color('#d9ffff')

export function createPortalEffect(params) {
  const uColor = uniform(new THREE.Color(params.portalColor))
  const uIntensity = uniform(params.portalIntensity)
  const uSpeed = uniform(params.portalSpeed)

  const coordinates = uv()
  const centered = coordinates.sub(0.5)
  const radial = centered.length().mul(2)
  const animatedTime = time.mul(uSpeed)
  const broadNoise = mx_noise_float(vec3(
    coordinates.x.mul(3),
    coordinates.y.mul(5).sub(animatedTime),
    animatedTime.mul(0.25),
  )).mul(0.5).add(0.5)
  const detailNoise = mx_noise_float(vec3(
    coordinates.x.mul(8).add(animatedTime.mul(0.15)),
    coordinates.y.mul(12).sub(animatedTime.mul(1.7)),
    animatedTime.mul(0.4),
  )).mul(0.5).add(0.5)
  const flow = broadNoise.mul(0.72).add(detailNoise.mul(0.28)).clamp(0, 1)
  const distortedRadius = radial.add(flow.sub(0.5).mul(0.18))
  const edge = smoothstep(0.55, 1, distortedRadius)
  const centerGlow = smoothstep(0.45, 1, flow.mul(0.65).add(radial.oneMinus().mul(0.55)))
  const breath = oscSine(time.div(3.5)).mul(0.16).add(0.84)

  const material = new THREE.MeshBasicNodeMaterial()
  material.name = 'portal-emission'
  material.colorNode = mix(
    mix(uColor, EDGE_COLOR, edge.mul(0.8)),
    CORE_COLOR,
    centerGlow.mul(0.72),
  ).mul(uIntensity).mul(breath)

  return {
    material,
    sync() {
      uColor.value.set(params.portalColor)
      uIntensity.value = params.portalIntensity
      uSpeed.value = params.portalSpeed
    },
  }
}
