import * as THREE from 'three/webgpu'
import { random01 } from '../../utils/random.js'

const HSL_JITTER = {
  hue: 0.025,
  saturation: 0.035,
  lightness: 0.035
}

const LAYER_SEED = {
  surface: 0,
  subsurface: 41,
  deep: 73,
  shore: 19
}

const PALETTE_SIZE = 12

export default class BrickColorResolver {
  constructor({ biomeRegistry, biomeBlender, config }) {
    this.biomeRegistry = biomeRegistry
    this.biomeBlender = biomeBlender
    this.config = config

    this._tmpColor = new THREE.Color()
    this._tmpHsl = { h: 0, s: 0, l: 0 }
    this._paletteCache = new Map()
  }

  resolveToColor(targetColor, { biomeCell, surfaceCell, layer, x, y, z }) {
    const biomeId = this.biomeBlender.pickDitheredBiomeId(
      biomeCell.weights,
      x,
      z,
      this.config.seed
    )

    const colors = this.biomeRegistry.get(biomeId).terrain.colors

    let colorKey
    if (layer === 'surface' && surfaceCell.isShore) {
      colorKey = 'shore'
    } else if (layer === 'surface') {
      colorKey = 'surface'
    } else if (layer === 'subsurface') {
      colorKey = 'subsurface'
    } else {
      colorKey = 'deep'
    }

    if (colorKey === 'surface') {
      const palette = this.getPalette(biomeId, colorKey, colors[colorKey])
      const layerSalt = LAYER_SEED[colorKey] ?? 0
      const index = Math.floor(
        random01(x, z, this.config.seed + y + layerSalt) * palette.length
      )
      targetColor.copy(palette[index])
    } else {
      targetColor.set(colors[colorKey])
    }

    return targetColor
  }

  getPalette(biomeId, colorKey, baseHex) {
    const cacheKey = `${biomeId}:${colorKey}`

    const cached = this._paletteCache.get(cacheKey)
    if (cached) {
      return cached
    }

    this._tmpColor.set(baseHex)
    this._tmpColor.getHSL(this._tmpHsl)

    const baseH = this._tmpHsl.h
    const baseS = this._tmpHsl.s
    const baseL = this._tmpHsl.l

    const palette = []
    const layerSalt = LAYER_SEED[colorKey] ?? 0
    const seed = this.config.seed + layerSalt

    for (let i = 0; i < PALETTE_SIZE; i++) {
      const h01 = random01(i, 11, seed + 101)
      const s01 = random01(i, 23, seed + 203)
      const l01 = random01(i, 37, seed + 307)

      const h = (baseH + (h01 * 2 - 1) * HSL_JITTER.hue + 1) % 1
      const s = THREE.MathUtils.clamp(
        baseS + (s01 * 2 - 1) * HSL_JITTER.saturation,
        0,
        1
      )
      const l = THREE.MathUtils.clamp(
        baseL + (l01 * 2 - 1) * HSL_JITTER.lightness,
        0,
        1
      )

      palette.push(new THREE.Color().setHSL(h, s, l))
    }

    this._paletteCache.set(cacheKey, palette)
    return palette
  }

  clearCache() {
    this._paletteCache.clear()
  }
}
