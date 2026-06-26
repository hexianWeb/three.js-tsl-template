import test from 'node:test'
import assert from 'node:assert/strict'
import { worldConfig } from '../src/world/WorldConfig.js'

test('defines first render chunk window config with halo sampling', () => {
  assert.deepEqual(worldConfig.terrain.renderChunk, {
    size: 72,
    halo: 1,
    quadrantThreshold: 0.75,
    hysteresisCells: 4,
    dwellSeconds: 0.25,
    buildsPerFrame: 1
  })
})

test('uses global biome centers that cross render chunk boundaries', () => {
  assert.deepEqual(worldConfig.biomes.regions.map((region) => region.center), [
    [0, 0],
    [145, 145],
    [290, 80],
    [435, 190]
  ])
})
