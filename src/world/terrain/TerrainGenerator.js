import { createNoise2D } from 'simplex-noise'
import HeightField from './HeightField.js'
import TerrainMap from './TerrainMap.js'
import SurfaceClassifier from './SurfaceClassifier.js'
import VolcanoSurfaceFeatureGenerator from './VolcanoSurfaceFeatureGenerator.js'
import { mulberry32 } from '../../utils/random.js'

export default class TerrainGenerator {
  constructor({ config, biomeMaskGenerator, biomeBlender, biomeRegistry }) {
    this.config = config
    this.biomeMaskGenerator = biomeMaskGenerator
    this.biomeBlender = biomeBlender
    this.surfaceClassifier = new SurfaceClassifier(config)
    this.volcanoSurfaceFeatureGenerator = new VolcanoSurfaceFeatureGenerator({
      config,
      biomeRegistry
    })
  }

  generate(options = {}) {
    this.noise2D = createNoise2D(mulberry32(this.config.seed))
    const terrain = this.config.terrain
    const visibleWidth = options.width ?? terrain.width
    const visibleDepth = options.depth ?? terrain.depth
    const halo = options.halo ?? 0
    const originX = options.originX ?? 0
    const originZ = options.originZ ?? 0
    const sampleOriginX = originX - halo
    const sampleOriginZ = originZ - halo
    const sampleWidth = visibleWidth + halo * 2
    const sampleDepth = visibleDepth + halo * 2
    const biomeCells = this.biomeMaskGenerator.generate({
      originX: sampleOriginX,
      originZ: sampleOriginZ,
      width: sampleWidth,
      depth: sampleDepth
    })
    const heightField = this.generateHeightField(biomeCells, {
      sampleOriginX,
      sampleOriginZ,
      width: sampleWidth,
      depth: sampleDepth
    })
    const surfaceCells = this.surfaceClassifier.classify(heightField)
    this.volcanoSurfaceFeatureGenerator.apply(biomeCells, surfaceCells, {
      sampleOriginX,
      sampleOriginZ
    })
    return new TerrainMap({
      heightField,
      biomeCells,
      surfaceCells,
      originX,
      originZ,
      sampleOriginX,
      sampleOriginZ,
      halo,
      visible: { x: halo, z: halo, width: visibleWidth, depth: visibleDepth }
    })
  }

  generateHeightField(biomeCells, options = {}) {
    const terrain = this.config.terrain
    const width = options.width ?? terrain.width
    const depth = options.depth ?? terrain.depth
    const sampleOriginX = options.sampleOriginX ?? 0
    const sampleOriginZ = options.sampleOriginZ ?? 0
    const field = new HeightField(width, depth)

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const biomeCell = biomeCells[z][x]
        const heightOffset = this.biomeBlender.blendTerrainParam(biomeCell.weights, 'heightOffset', 0)
        const heightMagnitude = this.biomeBlender.blendTerrainParam(biomeCell.weights, 'heightMagnitude', 1)

        const worldX = sampleOriginX + x
        const worldZ = sampleOriginZ + z
        const n01 = 0.5 + 0.5 * this.fbm(worldX, worldZ)
        const shaped = Math.max(0, Math.min(1, (n01 - terrain.seaClip) / (1 - terrain.seaClip)))
        const height = Math.floor(shaped * terrain.maxHeight * heightMagnitude + terrain.waterLevel + heightOffset)

        field.set(x, z, Math.max(0, Math.min(terrain.maxHeight, height)))
      }
    }

    return field
  }

  fbm(worldX, worldZ) {
    const terrain = this.config.terrain
    let value = 0
    let amplitude = 1
    let frequency = 1 / terrain.noiseScale
    let totalAmplitude = 0

    for (let octave = 0; octave < terrain.noiseOctaves; octave++) {
      value += this.noise2D(worldX * frequency, worldZ * frequency) * amplitude
      totalAmplitude += amplitude
      amplitude *= terrain.noiseGain
      frequency *= terrain.noiseLacunarity
    }

    return value / totalAmplitude
  }
}
