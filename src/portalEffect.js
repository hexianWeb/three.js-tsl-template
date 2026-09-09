import * as THREE from 'three/webgpu'
import {
  attribute,
  color,
  mix,
  mx_noise_float,
  oscSine,
  smoothstep,
  time,
  uniform,
  vec2,
  vec3,
} from 'three/tsl'

const CORE_COLOR = color('#e6f4ff')

// The bake atlas is not a full-face UV map. Keep it intact and give the
// procedural effect its own coordinates on the two widest local axes.
export function preparePortalCoordinates(geometry) {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  const size = bounds.getSize(new THREE.Vector3())
  const axes = ['x', 'y', 'z'].sort((a, b) => size[b] - size[a]).slice(0, 2)
  const position = geometry.getAttribute('position')
  const point = new THREE.Vector3()
  const coordinates = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i)
    axes.forEach((axis, component) => {
      coordinates[i * 2 + component] = (point[axis] - bounds.min[axis]) / Math.max(size[axis], 1e-6)
    })
  }
  geometry.setAttribute('portalUv', new THREE.BufferAttribute(coordinates, 2))
}

export function createPortalEffect(params) {
  const uColor = uniform(new THREE.Color(params.portalColor))
  const uIntensity = uniform(params.portalIntensity)
  const uSpeed = uniform(params.portalSpeed)

  const coordinates = attribute('portalUv', 'vec2')
  const centered = coordinates.sub(0.5)
  const radial = centered.length().mul(2)
  const animatedTime = time.mul(uSpeed)
  const warp = vec2(
    mx_noise_float(vec3(centered.mul(3), animatedTime)),
    mx_noise_float(vec3(centered.mul(3).add(7.3), animatedTime.negate())),
  )
  const warped = centered.add(warp.mul(0.3))
  const broadNoise = mx_noise_float(vec3(warped.mul(5), animatedTime.mul(0.7)))
  const detailNoise = mx_noise_float(vec3(warped.mul(11), animatedTime.negate()))
  // Journey-inspired turbulent clouds with a luminous perimeter.
  const flow = broadNoise.mul(0.75).add(detailNoise.mul(0.25)).mul(0.5).add(0.5)
  const edge = smoothstep(0.64, 1, radial.add(broadNoise.mul(0.13)))
  const clouds = smoothstep(0.32, 0.72, flow)
  const darkColor = uColor.mul(0.09).add(color('#170932'))
  const cloudColor = mix(darkColor, uColor, clouds)
  const breath = oscSine(time.div(3.5)).mul(0.16).add(0.84)

  const material = new THREE.MeshBasicNodeMaterial()
  material.name = 'portal-emission'
  material.colorNode = mix(
    cloudColor,
    CORE_COLOR,
    edge.mul(0.94),
  ).mul(uIntensity).mul(breath)
  material.side = THREE.DoubleSide

  return {
    material,
    sync() {
      uColor.value.set(params.portalColor)
      uIntensity.value = params.portalIntensity
      uSpeed.value = params.portalSpeed
    },
  }
}
