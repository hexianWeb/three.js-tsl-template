import test from 'node:test'
import assert from 'node:assert/strict'
import BiomeMaskGenerator from '../src/world/biomes/BiomeMaskGenerator.js'
import BiomeRegistry from '../src/world/biomes/BiomeRegistry.js'
import BiomeBlender from '../src/world/biomes/BiomeBlender.js'
import TerrainGenerator from '../src/world/terrain/TerrainGenerator.js'
import TerrainMap from '../src/world/terrain/TerrainMap.js'
import HeightField from '../src/world/terrain/HeightField.js'
import SurfaceClassifier from '../src/world/terrain/SurfaceClassifier.js'
import VolcanoSurfaceFeatureGenerator from '../src/world/terrain/VolcanoSurfaceFeatureGenerator.js'
import PrefabPlacer from '../src/world/prefabs/PrefabPlacer.js'

const makeConfig = () => ({
  seed: 20260608,
  terrain: {
    width: 80,
    depth: 80,
    maxHeight: 28,
    waterLevel: 3,
    noiseScale: 34,
    noiseOctaves: 4,
    noiseGain: 0.5,
    noiseLacunarity: 2,
    seaClip: 0.35,
    cellSize: 0.2,
    layerHeight: 0.095
  },
  biomes: {
    defaultBiome: 'forest',
    regions: [
      { id: 'forest', center: [0, 0], radius: 50, weight: 1 },
      { id: 'autumnForest', center: [145, 145], radius: 50, weight: 1 },
      { id: 'desert', center: [290, 80], radius: 50, weight: 1 },
      { id: 'volcano', center: [435, 190], radius: 50, weight: 1 }
    ]
  },
  placement: {
    enableTrees: true,
    rotationStep: Math.PI / 2
  }
})

function makeTerrainGenerator(config = makeConfig()) {
  const biomeRegistry = new BiomeRegistry()
  const biomeBlender = new BiomeBlender(biomeRegistry)
  return new TerrainGenerator({
    config,
    biomeMaskGenerator: new BiomeMaskGenerator(config),
    biomeBlender,
    biomeRegistry
  })
}

test('biome mask samples global coordinates including halo', () => {
  const generator = new BiomeMaskGenerator(makeConfig())
  const cells = generator.generate({ originX: 127, originZ: 127, width: 34, depth: 34 })

  assert.equal(cells.length, 34)
  assert.equal(cells[0].length, 34)
  assert.equal(cells[18][18].biomeId, 'autumnForest')
})

test('default biome fallback uses configured defaultBiome', () => {
  const config = makeConfig()
  config.biomes.defaultBiome = 'desert'
  config.biomes.regions = []

  const cell = new BiomeMaskGenerator(config).getCellBiome(999, 999)

  assert.deepEqual(cell, { biomeId: 'desert', weights: { desert: 1 } })
})

test('terrain map maps visible cells to sample cells and world blocks', () => {
  const heightField = new HeightField(34, 34)
  heightField.set(0, 1, 12)
  const biomeCells = Array.from({ length: 34 }, () =>
    Array.from({ length: 34 }, () => ({ biomeId: 'forest', weights: { forest: 1 } }))
  )
  const surfaceCells = Array.from({ length: 34 }, (_, z) =>
    Array.from({ length: 34 }, (_, x) => ({ x, z, height: heightField.get(x, z) }))
  )
  const terrainMap = new TerrainMap({
    heightField,
    biomeCells,
    surfaceCells,
    originX: 128,
    originZ: 128,
    sampleOriginX: 127,
    sampleOriginZ: 127,
    halo: 1,
    visible: { x: 1, z: 1, width: 32, depth: 32 }
  })

  assert.deepEqual(terrainMap.toSampleCell(-1, 0), { x: 0, z: 1 })
  assert.equal(terrainMap.hasCell(-1, 0), true)
  assert.equal(terrainMap.hasCell(-2, 0), false)
  assert.equal(terrainMap.getHeight(-1, 0), 12)
  assert.deepEqual(terrainMap.toWorldBlock(17, 17), { x: 145, z: 145 })
})

test('adjacent chunks agree where one visible edge overlaps the other halo', () => {
  const generator = makeTerrainGenerator()
  const left = generator.generate({ originX: 0, originZ: 0, width: 32, depth: 32, halo: 1 })
  const right = generator.generate({ originX: 32, originZ: 0, width: 32, depth: 32, halo: 1 })

  assert.equal(left.getHeight(31, 10), right.getHeight(-1, 10))
  assert.deepEqual(left.getBiomeCell(31, 10), right.getBiomeCell(-1, 10))
  const leftSurface = left.getSurfaceCell(31, 10)
  const rightSurface = right.getSurfaceCell(-1, 10)
  assert.deepEqual(
    {
      height: leftSurface.height,
      isWater: leftSurface.isWater,
      isShore: leftSurface.isShore,
      isLava: leftSurface.isLava
    },
    {
      height: rightSurface.height,
      isWater: rightSurface.isWater,
      isShore: rightSurface.isShore,
      isLava: rightSurface.isLava
    }
  )
})

test('terrain height noise uses world block coordinates instead of repeated local chunk coordinates', () => {
  const generator = makeTerrainGenerator()
  const origin = generator.generate({ originX: 0, originZ: 0, width: 32, depth: 32, halo: 1 })
  const distant = generator.generate({ originX: 128, originZ: 0, width: 32, depth: 32, halo: 1 })

  assert.notEqual(origin.getHeight(5, 5), distant.getHeight(5, 5))
})

test('volcano lava pool noise uses world sample coordinates', () => {
  const calls = []
  const generator = new VolcanoSurfaceFeatureGenerator({
    config: makeConfig(),
    biomeRegistry: {
      get() {
        return {
          lava: {
            poolDensity: 0.5,
            minVolcanoWeight: 0.65,
            poolCellScale: 12,
            poolEdgeWarp: 0,
            maxSlope: 4
          }
        }
      }
    }
  })
  generator.isPoolCell = (x, z) => {
    calls.push([x, z])
    return false
  }
  const biomeCells = [[{ biomeId: 'volcano', weights: { volcano: 1 } }]]
  const surfaceCells = [[{ x: 0, z: 0, height: 8, slope: 1, isWater: false }]]

  generator.apply(biomeCells, surfaceCells, { sampleOriginX: 127, sampleOriginZ: 127 })

  assert.deepEqual(calls, [[127, 127]])
})

test('prefab placement random decisions use world blocks while transforms stay local', () => {
  const config = makeConfig()
  config.seed = 1
  const biomeRegistry = {
    get() {
      return {
        prefabs: [{ id: 'marker', density: 1 }]
      }
    }
  }
  const prefabRegistry = {
    get() {
      return {
        entry: {
          category: 'marker',
          placement: { surface: 'land' },
          variants: [{ source: 'markerModel', weight: 1 }],
          randomRotation: true
        }
      }
    }
  }
  const placer = new PrefabPlacer({ config, biomeRegistry, prefabRegistry })
  const biomeCell = { biomeId: 'forest', weights: { forest: 1 } }
  const surfaceCell = { height: 4, slope: 0, isWater: false, isShore: false }
  const terrainMap = {
    width: 1,
    depth: 1,
    getBiomeCell() {
      return biomeCell
    },
    getSurfaceCell() {
      return surfaceCell
    },
    toWorldBlock() {
      return { x: 145, z: 145 }
    }
  }

  const buckets = placer.collectTransforms(terrainMap)
  const transform = [...buckets.values()][0].transforms[0]

  assert.deepEqual(transform.position, [0.1, 0.475, 0.1])
  assert.equal(transform.x, 0)
  assert.equal(transform.z, 0)
  assert.equal(transform.worldX, 145)
  assert.equal(transform.worldZ, 145)
})
