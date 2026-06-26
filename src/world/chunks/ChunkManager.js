import {
  getActiveWindowKeys,
  getRenderChunkCoord,
  getRenderChunkKey,
  getRenderChunkOrigin,
  toLocalCell
} from './chunkCoordinates.js'

export default class ChunkManager {
  constructor({
    size = 32,
    quadrantThreshold = 0.75,
    hysteresisCells = 4,
    dwellSeconds = 0.25
  } = {}) {
    this.size = size
    this.quadrantThreshold = quadrantThreshold
    this.hysteresisCells = hysteresisCells
    this.dwellSeconds = dwellSeconds
    this.anchorCoord = null
    this.activeKeys = []
    this.candidateKey = null
    this.candidateSeconds = 0
  }

  update(worldBlock, deltaSeconds = 0, movement = null) {
    const candidateCoord = getRenderChunkCoord(worldBlock.x, worldBlock.z, this.size)
    const candidateKey = getRenderChunkKey(candidateCoord)

    if (!this.anchorCoord) {
      return this.setAnchor(candidateCoord, worldBlock, movement)
    }

    const anchorKey = getRenderChunkKey(this.anchorCoord)
    if (candidateKey === anchorKey) {
      this.candidateKey = null
      this.candidateSeconds = 0
      return this.setActiveKeys(this.getActiveKeys(this.anchorCoord, worldBlock, movement))
    }

    if (this.candidateKey === candidateKey) {
      this.candidateSeconds += deltaSeconds
    } else {
      this.candidateKey = candidateKey
      this.candidateSeconds = deltaSeconds
    }

    if (
      this.isPastHysteresis(worldBlock, candidateCoord) ||
      this.candidateSeconds >= this.dwellSeconds
    ) {
      return this.setAnchor(candidateCoord, worldBlock, movement)
    }

    return this.currentResult(false, [], [])
  }

  setAnchor(anchorCoord, worldBlock, movement = null) {
    this.anchorCoord = { ...anchorCoord }
    this.candidateKey = null
    this.candidateSeconds = 0
    return this.setActiveKeys(this.getActiveKeys(this.anchorCoord, worldBlock, movement), true)
  }

  setActiveKeys(activeKeys, forceChanged = false) {
    const previousKeys = this.activeKeys
    this.activeKeys = activeKeys
    const previousSet = new Set(previousKeys)
    const nextSet = new Set(this.activeKeys)
    const loadKeys = this.activeKeys.filter((key) => !previousSet.has(key))
    const unloadKeys = previousKeys.filter((key) => !nextSet.has(key))
    return this.currentResult(forceChanged || loadKeys.length > 0 || unloadKeys.length > 0, loadKeys, unloadKeys)
  }

  getActiveKeys(anchorCoord, worldBlock, movement = null) {
    const origin = getRenderChunkOrigin(anchorCoord, this.size)
    return getActiveWindowKeys(
      anchorCoord,
      toLocalCell(origin, worldBlock.x, worldBlock.z),
      this.size,
      this.quadrantThreshold,
      movement
    )
  }

  currentResult(changed, loadKeys, unloadKeys) {
    return {
      changed,
      anchorCoord: { ...this.anchorCoord },
      anchorKey: getRenderChunkKey(this.anchorCoord),
      activeKeys: [...this.activeKeys],
      loadKeys,
      unloadKeys
    }
  }

  isPastHysteresis(worldBlock, candidateCoord) {
    const changedAxes = []
    if (candidateCoord.x !== this.anchorCoord.x) {
      changedAxes.push('x')
    }
    if (candidateCoord.z !== this.anchorCoord.z) {
      changedAxes.push('z')
    }

    return changedAxes.every((axis) => {
      const origin = getRenderChunkOrigin(candidateCoord, this.size)
      const candidateValue = candidateCoord[axis]
      const anchorValue = this.anchorCoord[axis]
      const worldValue = worldBlock[axis]

      if (candidateValue > anchorValue) {
        return worldValue - origin[axis] >= this.hysteresisCells
      }

      const candidateMax = origin[axis] + this.size - 1
      return candidateMax - worldValue + 1 >= this.hysteresisCells
    })
  }
}
