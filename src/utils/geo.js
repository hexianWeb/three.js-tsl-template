import * as THREE from 'three/webgpu';

/**
 * 经纬度（度）→ 单位球上的向量（Y 轴向上）。
 * 约定：lng=0, lat=0 对应 +X 方向。
 * @param {number} lng
 * @param {number} lat
 * @param {THREE.Vector3} [out]
 */
export function lngLatToUnitVec3(lng, lat, out = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng);
  out.set(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
  return out;
}
