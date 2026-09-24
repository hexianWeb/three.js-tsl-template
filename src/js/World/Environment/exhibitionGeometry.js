import * as THREE from 'three/webgpu'

// 平面圆角与竖向倒角独立：薄底座不能用受厚度限制的 RoundedBox 半径代替平面轮廓。
export function createPlinthGeometry(width, depth, height, cornerRadius, bevel) {
  const edge = Math.max(0.0001, Math.min(bevel, height * 0.24, width * 0.05, depth * 0.05))
  const x = width / 2 - edge
  const z = depth / 2 - edge
  const r = THREE.MathUtils.clamp(cornerRadius - edge, edge, Math.min(x, z))
  const shape = new THREE.Shape()
  shape.moveTo(-x + r, -z)
  shape.lineTo(x - r, -z)
  shape.quadraticCurveTo(x, -z, x, -z + r)
  shape.lineTo(x, z - r)
  shape.quadraticCurveTo(x, z, x - r, z)
  shape.lineTo(-x + r, z)
  shape.quadraticCurveTo(-x, z, -x, z - r)
  shape.lineTo(-x, -z + r)
  shape.quadraticCurveTo(-x, -z, -x + r, -z)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - edge * 2,
    bevelEnabled: true,
    bevelSize: edge,
    bevelThickness: edge,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 12,
  })
  // Extrude 沿局部 +Z 生长；居中后旋到世界 +Y，最终上下界严格为 ±height/2。
  geometry.translate(0, 0, edge - height / 2)
  geometry.rotateX(-Math.PI / 2)
  geometry.computeBoundingBox()
  return geometry
}

export function createCycloramaGeometry(width, depth, radius, wallHeight) {
  const r = Math.min(radius, depth * 0.4, wallHeight)
  const curveStart = -depth / 2 + r
  const floorLength = depth - r
  // 地面、四分之一圆弧与竖墙共用连续剖面，消除共面重叠及法线接缝。
  const rows = [
    { y: 0, z: depth / 2, ny: 1, nz: 0, distance: 0 },
    { y: 0, z: curveStart, ny: 1, nz: 0, distance: floorLength },
  ]
  for (let i = 1; i <= 48; i++) {
    const angle = i / 48 * Math.PI / 2
    rows.push({
      y: r * (1 - Math.cos(angle)),
      z: curveStart - r * Math.sin(angle),
      ny: Math.cos(angle),
      nz: Math.sin(angle),
      distance: floorLength + r * angle,
    })
  }
  rows.push({ y: wallHeight, z: -depth / 2, ny: 0, nz: 1, distance: floorLength + r * Math.PI / 2 + wallHeight - r })
  const positions = []
  const normals = []
  const uvs = []
  const indices = []
  rows.forEach((row, index) => {
    for (const x of [-width / 2, width / 2]) {
      positions.push(x, row.y, row.z)
      normals.push(0, row.ny, row.nz)
      // UV 使用真实剖面距离；转角纹理不会像世界 XZ 投影一样被拉成条纹。
      uvs.push(x, row.distance)
    }
    if (index < rows.length - 1) {
      const a = index * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  return geometry
}
