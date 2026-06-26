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

export function getActiveWindowKeys(anchorCoord, localCell, chunkSize, quadrantThreshold = 0.75) {
  const xStep = localCell.x < chunkSize * quadrantThreshold ? -1 : 1
  const zStep = localCell.z < chunkSize * quadrantThreshold ? -1 : 1
  const minX = Math.min(anchorCoord.x, anchorCoord.x + xStep)
  const maxX = Math.max(anchorCoord.x, anchorCoord.x + xStep)
  const minZ = Math.min(anchorCoord.z, anchorCoord.z + zStep)
  const maxZ = Math.max(anchorCoord.z, anchorCoord.z + zStep)
  const keys = []
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      keys.push(getRenderChunkKey({ x, z }))
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
