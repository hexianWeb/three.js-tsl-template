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

export function getActiveWindowKeys(anchorCoord, activeRadius) {
  const keys = []
  for (let z = anchorCoord.z - activeRadius; z <= anchorCoord.z + activeRadius; z++) {
    for (let x = anchorCoord.x - activeRadius; x <= anchorCoord.x + activeRadius; x++) {
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
