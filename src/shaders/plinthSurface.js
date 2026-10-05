import { materialRoughness, modelWorldMatrix, positionLocal, vec3 } from 'three/tsl'
import { filteredPlasticNoise, plasticSurfaceNormal } from './controllerPlastic.js'

export function plinthSurfaceNodes(u) {
  // 保留底座局部轴，只补偿模型缩放；颗粒以世界长度计量，移动/旋转不改变采样相位。
  const scale = vec3(
    modelWorldMatrix.element(0).xyz.length(),
    modelWorldMatrix.element(1).xyz.length(),
    modelWorldMatrix.element(2).xyz.length(),
  )
  const coordinate = positionLocal.mul(scale)
  const grain = filteredPlasticNoise(coordinate.mul(u.grainFrequency)).toVar()
  const roughnessNoise = filteredPlasticNoise(coordinate.mul(u.roughnessFrequency)).toVar()
  // 噪声高度使用世界长度，bumpStrength 只控制微表面坡度；远处由导数过滤退回平均材质。
  const height = grain.mul(u.bumpStrength).div(u.grainFrequency)
  return {
    normal: plasticSurfaceNormal(height),
    roughness: materialRoughness.add(roughnessNoise.mul(u.roughnessVariation)).clamp(0.08, 1),
  }
}
