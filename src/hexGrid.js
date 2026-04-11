import { Fn, vec2,vec3, vec4, max, dot,sin,abs, floor, float, uniform, uv, length, pow ,mx_noise_float,smoothstep,remap,time} from 'three/tsl'
import * as THREE from 'three/webgpu'

/**
 * Procedural hexagonal grid texture using TSL.
 * Produces a black-and-white hex grid pattern with barrel distortion.
 */
export function createHexGridMaterial() {
  const material = new THREE.MeshBasicNodeMaterial()

  const hexScale = uniform(0.08)
  const lineWidth = uniform(0.038)
  const aspect = uniform(1.0)
  const distortionStrength = uniform(-0.3)
  const distortionPower = uniform(1.5)
  const displayMode = uniform(0) // 0 = lines, 1 = distance field
  const distancePow = uniform(1.0) // pow curve for distance field
  const transition = uniform(0.1)
  // sqrt(3) ≈ 1.7320508
  const sqrt3 = float(1.7320508)

  // Hex size vector (pointy-top hexagons)
  const s = vec2(1.0, sqrt3)

  /**
   * Hex boundary distance (pointy-top).
   * Returns signed distance to nearest hex edge.
   * Negative outside, positive inside.
   */
  const hex = Fn(([p]) => {
    const ap = abs(p)
    // max(dot(p, s*0.5), p.x) for pointy-top
    return max(dot(ap, s.mul(0.5)), ap.x)
  })

  /**
   * Returns hex cell offset + cell ID (center coords).
   * Produces a seamless tiling of hexagons.
   */
  const getHex = Fn(([p]) => {
    // Two interleaved offset grids
    const hC = floor(vec4(p, p.sub(vec2(0.5, 1.0))).div(s.xyxy)).add(0.5)

    // Local coords relative to each grid's cell center
    const h = vec4(
      p.sub(hC.xy.mul(s)),
      p.sub(hC.zw.add(0.5).mul(s))
    )

    // Pick nearest cell (squared Euclidean comparison)
    const d = vec2(dot(h.xy, h.xy), dot(h.zw, h.zw))

    // return vec4(localOffset, cellID)
    return d.x.lessThan(d.y)
      .select(vec4(h.xy, hC.xy), vec4(h.zw, hC.zw.add(0.5)))
  })

  /**
   * Barrel distortion from center outward.
   * strength: 0 = no distortion, positive = barrel, negative = pincushion
   * power: controls the curve shape (1.0 = linear, >1 = stronger at edges)
   */
  const barrelDistort = Fn(([centered, strength, power]) => {
    const r = length(centered)
    // Avoid division by zero
    const safeR = max(r, float(0.0001))
    // Normalized radius (0 at center, ~0.707 at corners)
    const normalizedR = safeR.mul(float(1.414))
    // Apply power curve and strength
    const distortedR = pow(normalizedR, float(1.0).sub(strength.mul(power)))
    // Scale factor
    const scale = distortedR.div(safeR)
    return centered.mul(scale)
  })

  material.colorNode = Fn(() => {
    // Start with UV centered at (0, 0)
    const centered = uv().xy.sub(0.5)

    // Apply barrel distortion
    const distorted = barrelDistort(centered, distortionStrength, distortionPower)

    // Correct aspect and scale
    const uvCorrected = vec2(distorted.x.mul(aspect), distorted.y)
    const p = uvCorrected.div(hexScale)

    const h = getHex(p)
    const d = hex(h.xy).mul(hexScale)

    // Distance field mode: normalized distance (0 at edge, 1 at center)
    // Max distance at hex center ≈ 0.5 * hexScale for unit hex
    const maxDist = float(0.5).mul(hexScale)
    const normalizedDist = d.div(maxDist).clamp(0.0, 1.0)

    // Apply pow curve: >1 pushes white toward center (more black), <1 pushes black toward edges
    const curvedDist = pow(normalizedDist, distancePow)

    // Outside hex (negative d) = black
    const distField = d.greaterThan(float(0.0)).select(curvedDist, float(0.0))

    const z = mx_noise_float(abs(h.zw.mul(0.6)))

    const offset = float(0.2)


    const bounceTransition = smoothstep(0., 0.5, abs(transition.sub(0.5))).oneMinus();

    const blendCut = smoothstep(
      uv().y.sub(offset),
      uv().y.add(offset),
      remap(transition.add(z.mul(0.08).mul(bounceTransition)), 0., 1., offset.mul(-1), float(1).add(offset))
    );

    const merge = smoothstep(0,0.5,abs(blendCut.sub(0.5))).oneMinus()

    const textureUV = uvCorrected.add(
      curvedDist.mul(sin(uv().y.mul(15).sub(time))).mul(merge).mul(0.025)
    )

    return vec4(vec3(merge),1.0)
  })()

  return { material, hexScale, lineWidth, aspect, distortionStrength, distortionPower, displayMode, distancePow,transition }
}
