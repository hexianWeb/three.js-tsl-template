export function getRenderChunkCoord(worldBlockX, worldBlockZ, chunkSize) {
  return {
    x: Math.floor(worldBlockX / chunkSize),
    z: Math.floor(worldBlockZ / chunkSize)
  }
}

export function getRenderChunkKey(coord) {
  return `${coord.x}:${coord.z}`
}

export function parseRenderChunkKey(key) {
  const [x, z] = key.split(':').map((value) => Number.parseInt(value, 10))
  return { x, z }
}

export function getRenderChunkOrigin(coord, chunkSize) {
  return {
    x: coord.x * chunkSize,
    z: coord.z * chunkSize
  }
}

export function getDominantMovementAxis(movement, { minSpeed = 0.05 } = {}) {
  if (!movement) {
    return null
  }

  const blockVelocityX = movement.x ?? 0
  const blockVelocityZ = movement.z ?? 0
  const absX = Math.abs(blockVelocityX)
  const absZ = Math.abs(blockVelocityZ)

  if (absX < minSpeed && absZ < minSpeed) {
    return null
  }

  if (absX >= absZ * 1.5 && absX >= minSpeed) {
    return { dx: Math.sign(blockVelocityX), dz: 0 }
  }

  if (absZ >= absX * 1.5 && absZ >= minSpeed) {
    return { dx: 0, dz: Math.sign(blockVelocityZ) }
  }

  return null
}

export function getActiveWindowKeys(anchorCoord, localCell, chunkSize, quadrantThreshold = 0.75, movement = null) {
  const edgeSize = chunkSize * (1 - quadrantThreshold)
  const nearLeft = localCell.x < edgeSize
  const nearRight = localCell.x >= chunkSize - edgeSize
  const nearNorth = localCell.z < edgeSize
  const nearSouth = localCell.z >= chunkSize - edgeSize

  const xSteps = new Set()
  const zSteps = new Set()

  if (nearLeft) {
    xSteps.add(-1)
  }
  if (nearRight) {
    xSteps.add(1)
  }
  if (nearNorth) {
    zSteps.add(-1)
  }
  if (nearSouth) {
    zSteps.add(1)
  }

  const dominantAxis = getDominantMovementAxis(movement)
  if (dominantAxis) {
    if (dominantAxis.dx !== 0 && !nearLeft && !nearRight) {
      xSteps.add(dominantAxis.dx)
    }
    if (dominantAxis.dz !== 0 && !nearNorth && !nearSouth) {
      zSteps.add(dominantAxis.dz)
    }
  }

  const xArr = [...xSteps].sort((a, b) => a - b)
  const zArr = [...zSteps].sort((a, b) => a - b)
  const keys = [getRenderChunkKey(anchorCoord)]

  for (const xStep of xArr) {
    keys.push(getRenderChunkKey({ x: anchorCoord.x + xStep, z: anchorCoord.z }))
  }
  for (const zStep of zArr) {
    keys.push(getRenderChunkKey({ x: anchorCoord.x, z: anchorCoord.z + zStep }))
  }
  for (const xStep of xArr) {
    for (const zStep of zArr) {
      keys.push(getRenderChunkKey({ x: anchorCoord.x + xStep, z: anchorCoord.z + zStep }))
    }
  }

  return keys
}

export function toWorldBlock(origin, localX, localZ) {
  return {
    x: origin.x + localX,
    z: origin.z + localZ
  }
}

export function toLocalCell(origin, worldX, worldZ) {
  return {
    x: worldX - origin.x,
    z: worldZ - origin.z
  }
}
