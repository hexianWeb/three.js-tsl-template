import { Fn, vec2,vec3,oscSine, step, vec4, max, dot,sin,abs, floor, float, uniform, uv, length, pow ,mx_noise_float,smoothstep,remap,time, texture as tslTexture, mix as tslMix} from 'three/tsl'
import * as THREE from 'three/webgpu'

/**
 * Procedural hexagonal grid texture using TSL.
 * Produces a black-and-white hex grid pattern with barrel distortion.
 */
export function createHexGridMaterial(tex1, tex2) {
  const material = new THREE.MeshBasicNodeMaterial()

  const hexScale = uniform(0.03)
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
    const centered = uv().xy.sub(0.5)
    const distorted = barrelDistort(centered, distortionStrength, distortionPower)
    const uvCorrected = vec2(distorted.x.mul(aspect), distorted.y)
    const p = uvCorrected.div(hexScale)
    const hexagons = getHex(p)
    const d = hex(hexagons.xy).mul(hexScale)
  
    // --- 基础距离场（保持）---
    const maxDist = float(0.5).mul(hexScale)
    const normalizedDist = d.div(maxDist).clamp(0.0, 1.0)
    const curvedDist = pow(normalizedDist, distancePow)
  
    // --- 动态噪声层 ---
    // 低频大波浪 + 高频细节，制造有机边缘
    const timeSlow = time.mul(0.3)
    const timeFast = time.mul(1.2)
    
    // 空间扰动：让切割线本身弯曲
    const warpUV = uv().mul(vec2(3.0, 2.0)).add(vec2(timeSlow, timeSlow.mul(0.5)))
    const warpNoise = mx_noise_float(warpUV) // 低频波浪形态
    
    const detailUV = uv().mul(vec2(8.0, 12.0)).add(vec2(timeFast.mul(-0.3), 0))
    const detailNoise = mx_noise_float(detailUV).mul(0.15) // 高频边缘破碎
  
    // 组合：基础过渡 + 波浪弯曲 + 细节粗糙
    const edgeWarp = warpNoise.mul(0.25).add(detailNoise)
    
        const bounceTransition = pow(
      sin(transition.mul(Math.PI)),
      float(2.0)
    )
    // --- 改进的切割逻辑 ---
    // 不再是直线 uv().y，而是"波浪线"
    const baseLine = uv().y
    const warpedLine = baseLine.add(edgeWarp.mul(bounceTransition))
    
    // 用 smoothstep 替代 step，并加入 hex 网格的局部变化
    // 让切割边缘也受 hex 距离场影响，产生"格子感"的撕裂
    const hexInfluence = curvedDist.mul(0.15).mul(bounceTransition)
    
    const cutThreshold = transition.add(hexInfluence).add(edgeWarp.mul(0.1))
    
    // 软边切割：带抗锯齿的过渡
    const edgeSoftness = float(0.08).add(detailNoise.mul(0.05)).mul(bounceTransition)
    const cut = smoothstep(
      cutThreshold.sub(edgeSoftness),
      cutThreshold.add(edgeSoftness),
      warpedLine
    )
  
    // --- 纹理扰动采样（保持你的逻辑）---
    const disturbedUV = uv().add(
      curvedDist.mul(sin(uv().y.mul(15).sub(time))).mul(cut.oneMinus().mul(cut).mul(4.0)).mul(0.05)
    )
  
    const sample1 = tslTexture(tex1, disturbedUV)
    const sample2 = tslTexture(tex2, disturbedUV)
    const finalColor = tslMix(sample1, sample2, cut)
  
    return vec4(finalColor.rgb, 1.0)
  })()
  return { material, hexScale, lineWidth, aspect, distortionStrength, distortionPower, displayMode, distancePow,transition }
}
