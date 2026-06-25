# Authored Biome Route Implementation Plan

> **Status:** Superseded by two smaller execution plans. Use `docs/superpowers/plans/2026-06-25-chunk-manager-terrain-streaming-implementation.md` first, then `docs/superpowers/plans/2026-06-25-biome-achievement-system-implementation.md`. This original document is kept as historical context only.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a hand-authored global biome route with 32x32 render chunks, a debounced 3x3 active chunk window, unordered biome discovery achievements, and story-ordered ruin progression.

**Architecture:** Keep biome and chunk math pure and testable first, then wire it into `World`. Render chunks are loading/rendering windows only; biome regions, ruins, achievements, and story order use global block coordinates. Runtime progression is handled by a small controller that observes the player aircraft position and emits UI/story events through the existing event bus.

**Tech Stack:** Three.js WebGPU, existing `World.addSystem()` lifecycle, `node:test`, `mitt` event bus, existing terrain/brick/prefab generation classes, Vite.

---

## Implementation Priority

Build the terrain streaming foundation before adding exploration motivation:

1. Finish stable aircraft-following terrain first: Task 1, Task 2, Task 3, Task 4, Task 9, Task 10, then run the chunk seam checks in Task 11.
2. Add the reason to explore after streaming is visually stable: Task 5, Task 6, Task 7, Task 8, then rerun Task 11.

Critical terrain invariant: a render chunk displays exactly `32x32` visible cells, but terrain generation samples a 1-cell halo around it. With `size: 32` and `halo: 1`, generation produces `34x34` sample data from `origin - 1` through `origin + 32`; renderers and prefab placement only consume the inner visible `32x32`. This is required because `LayeredTerrainBuilder`, `HeightfieldAO`, side brick generation, shoreline/water classification, and cliff exposure decisions read `x +/- 1` and `z +/- 1` neighbor heights.

---

## File Structure

- Modify `src/world/WorldConfig.js`
  - Replace compact local biome regions with authored global route metadata.
  - Add `terrain.renderChunk` streaming config.
- Create `src/world/chunks/chunkCoordinates.js`
  - Pure coordinate helpers for render chunk keys, origins, 3x3 windows, and block/cell conversion.
- Create `src/world/chunks/ChunkManager.js`
  - Pure active-window state machine with stable `anchorChunk`, hysteresis, dwell time, and 3x3 key output.
- Create `src/world/chunks/RenderChunk.js`
  - Owns one chunk root group and reuses existing terrain/water/lava/prefab renderers for one 32x32 visible terrain map backed by halo samples.
- Modify `src/world/biomes/BiomeMaskGenerator.js`
  - Sample biome regions using global world block coordinates while still returning local terrain cells.
- Modify `src/world/terrain/TerrainGenerator.js`
  - Accept chunk origin and pass it to biome and noise sampling.
- Modify `src/world/terrain/TerrainMap.js`
  - Store chunk metadata, visible bounds, and halo sample mapping; expose `toWorldBlock(x, z)`, `toSampleCell(x, z)`, and `hasCell(x, z)`.
- Modify `src/world/terrain/SurfaceClassifier.js`
  - Classify the generated sample field dimensions, including halo cells.
- Modify `src/world/terrain/VolcanoSurfaceFeatureGenerator.js`
  - Process sample-field dimensions and use global sample coordinates for lava pool noise.
- Modify `src/world/terrain/LayeredTerrainBuilder.js`
  - Preserve local placements while including world block metadata on placements.
- Modify `src/world/bricks/HeightfieldAO.js`
  - Use visible chunk bounds and halo-aware neighbor sampling.
- Modify `src/world/bricks/WaterBrickRenderer.js`, `src/world/bricks/LavaBrickRenderer.js`, `src/world/prefabs/PrefabPlacer.js`
  - Iterate `terrainMap.width`/`terrainMap.depth` visible cells instead of global `config.terrain.width`/`config.terrain.depth`.
- Create `src/world/biomes/BiomeRouteService.js`
  - Pure route service for `currentVisualBiome`, `confirmedBiome`, next story target, and route events.
- Create `src/world/progression/ProgressState.js`
  - In-memory session progress for confirmed/discovered biomes, achievements, ruins, stories, and story index.
- Create `src/world/story/BiomeStoryController.js`
  - World system that reads `PlayerAircraft`, updates route/progress state, emits HUD/story events, and owns placeholder ruin markers.
- Create `src/ui/GameHUD.js`
  - DOM HUD for confirmed biome, discovery achievements, blocked ruins, next target, and completion notices.
- Modify `src/app/Experience.js`
  - Instantiate and dispose `GameHUD`.
- Modify `src/world/world.js`
  - Replace single terrain regenerate path with `ChunkManager` + `RenderChunk` active-window update.
- Create tests:
  - `test/authoredBiomeRouteConfig.test.js`
  - `test/chunkCoordinates.test.js`
  - `test/chunkManager.test.js`
  - `test/globalBiomeMask.test.js`
  - `test/biomeRouteService.test.js`
  - `test/progressState.test.js`
  - `test/biomeStoryController.test.js`
  - `test/renderChunk.test.js`

---

### Task 1: Add Authored Route And Render Chunk Config

**Files:**
- Modify: `src/world/WorldConfig.js`
- Create: `test/authoredBiomeRouteConfig.test.js`

- [ ] **Step 1: Write the failing config test**

Create `test/authoredBiomeRouteConfig.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { worldConfig } from '../src/world/WorldConfig.js'

test('defines authored biome route metadata in story order', () => {
  const { regions } = worldConfig.biomes

  assert.deepEqual(regions.map((region) => region.id), [
    'forest',
    'autumnForest',
    'desert',
    'volcano'
  ])
  assert.deepEqual(regions.map((region) => region.storyOrder), [0, 1, 2, 3])
  assert.deepEqual(regions.map((region) => region.radius), [50, 50, 50, 50])
  assert.deepEqual(regions.map((region) => region.achievementRadius), [40, 40, 40, 40])
  assert.deepEqual(regions.map((region) => region.discoveryAchievementId), [
    'biome_forest_discovered',
    'biome_autumn_forest_discovered',
    'biome_desert_discovered',
    'biome_volcano_discovered'
  ])
  assert.equal(regions.every((region) => region.ruinId && region.storyId && region.displayName), true)
})

test('uses global route centers that cross render chunk boundaries', () => {
  assert.deepEqual(worldConfig.biomes.regions.map((region) => region.center), [
    [0, 0],
    [145, 145],
    [290, 80],
    [435, 190]
  ])
})

test('defines first render chunk window config', () => {
  assert.deepEqual(worldConfig.terrain.renderChunk, {
    size: 32,
    halo: 1,
    activeRadius: 1,
    hysteresisCells: 4,
    dwellSeconds: 0.25
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- test/authoredBiomeRouteConfig.test.js
```

Expected: FAIL because the current regions are still compact local test regions and `terrain.renderChunk` does not exist.

- [ ] **Step 3: Update `WorldConfig.js`**

In `src/world/WorldConfig.js`, add `renderChunk` inside `terrain` after `depth`:

```js
    renderChunk: {
      size: 32,
      halo: 1,
      activeRadius: 1,
      hysteresisCells: 4,
      dwellSeconds: 0.25
    },
```

Replace `biomes.regions` with:

```js
    defaultBiome: 'forest',
    achievementRadius: 40,
    ruinActivationRadius: 5,
    regions: [
      {
        id: 'forest',
        displayName: 'Forest',
        center: [0, 0],
        radius: 50,
        achievementRadius: 40,
        weight: 1,
        storyOrder: 0,
        discoveryAchievementId: 'biome_forest_discovered',
        ruinId: 'forest_ruin',
        storyId: 'forest_comic'
      },
      {
        id: 'autumnForest',
        displayName: 'Autumn Forest',
        center: [145, 145],
        radius: 50,
        achievementRadius: 40,
        weight: 1,
        storyOrder: 1,
        discoveryAchievementId: 'biome_autumn_forest_discovered',
        ruinId: 'autumn_forest_ruin',
        storyId: 'autumn_forest_comic'
      },
      {
        id: 'desert',
        displayName: 'Desert',
        center: [290, 80],
        radius: 50,
        achievementRadius: 40,
        weight: 1,
        storyOrder: 2,
        discoveryAchievementId: 'biome_desert_discovered',
        ruinId: 'desert_ruin',
        storyId: 'desert_comic'
      },
      {
        id: 'volcano',
        displayName: 'Volcano',
        center: [435, 190],
        radius: 50,
        achievementRadius: 40,
        weight: 1,
        storyOrder: 3,
        discoveryAchievementId: 'biome_volcano_discovered',
        ruinId: 'volcano_ruin',
        storyId: 'volcano_comic'
      }
    ]
```

- [ ] **Step 4: Verify the config test passes**

Run:

```bash
npm test -- test/authoredBiomeRouteConfig.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/world/WorldConfig.js test/authoredBiomeRouteConfig.test.js
git commit -m "feat: configure authored biome route"
```

---

### Task 2: Add Render Chunk Coordinate Helpers

**Files:**
- Create: `src/world/chunks/chunkCoordinates.js`
- Create: `test/chunkCoordinates.test.js`

- [ ] **Step 1: Write the failing coordinate tests**

Create `test/chunkCoordinates.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getRenderChunkCoord,
  getRenderChunkKey,
  getRenderChunkOrigin,
  getActiveWindowKeys,
  toWorldBlock,
  toLocalCell
} from '../src/world/chunks/chunkCoordinates.js'

test('maps world blocks to signed render chunk coordinates', () => {
  assert.deepEqual(getRenderChunkCoord(0, 0, 32), { x: 0, z: 0 })
  assert.deepEqual(getRenderChunkCoord(31, 31, 32), { x: 0, z: 0 })
  assert.deepEqual(getRenderChunkCoord(32, 32, 32), { x: 1, z: 1 })
  assert.deepEqual(getRenderChunkCoord(-1, -1, 32), { x: -1, z: -1 })
})

test('builds stable chunk keys and origins', () => {
  assert.equal(getRenderChunkKey({ x: 4, z: 4 }), '4:4')
  assert.deepEqual(getRenderChunkOrigin({ x: 4, z: 4 }, 32), { x: 128, z: 128 })
})

test('builds a deterministic 3x3 active window around anchor chunk', () => {
  assert.deepEqual(getActiveWindowKeys({ x: 2, z: 3 }, 1), [
    '1:2', '2:2', '3:2',
    '1:3', '2:3', '3:3',
    '1:4', '2:4', '3:4'
  ])
})

test('converts between local chunk cells and world blocks', () => {
  const origin = { x: 128, z: 128 }

  assert.deepEqual(toWorldBlock(origin, 17, 17), { x: 145, z: 145 })
  assert.deepEqual(toLocalCell(origin, 145, 145), { x: 17, z: 17 })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- test/chunkCoordinates.test.js
```

Expected: FAIL because `chunkCoordinates.js` does not exist.

- [ ] **Step 3: Implement coordinate helpers**

Create `src/world/chunks/chunkCoordinates.js`:

```js
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
  const [x, z] = key.split(':').map(Number)
  return { x, z }
}

export function getRenderChunkOrigin(coord, chunkSize) {
  return {
    x: coord.x * chunkSize,
    z: coord.z * chunkSize
  }
}

export function getActiveWindowKeys(anchorCoord, activeRadius = 1) {
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
```

- [ ] **Step 4: Verify coordinate tests pass**

Run:

```bash
npm test -- test/chunkCoordinates.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/world/chunks/chunkCoordinates.js test/chunkCoordinates.test.js
git commit -m "feat: add render chunk coordinates"
```

---

### Task 3: Make Biome And Terrain Generation Chunk-Origin Aware

**Files:**
- Modify: `src/world/biomes/BiomeMaskGenerator.js`
- Modify: `src/world/terrain/TerrainGenerator.js`
- Modify: `src/world/terrain/TerrainMap.js`
- Modify: `src/world/terrain/SurfaceClassifier.js`
- Modify: `src/world/terrain/VolcanoSurfaceFeatureGenerator.js`
- Modify: `src/world/terrain/LayeredTerrainBuilder.js`
- Modify: `src/world/bricks/HeightfieldAO.js`
- Modify: `src/world/bricks/WaterBrickRenderer.js`
- Modify: `src/world/bricks/LavaBrickRenderer.js`
- Modify: `src/world/prefabs/PrefabPlacer.js`
- Create: `test/globalBiomeMask.test.js`

- [ ] **Step 1: Write the failing global biome tests**

Create `test/globalBiomeMask.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import BiomeMaskGenerator from '../src/world/biomes/BiomeMaskGenerator.js'
import TerrainMap from '../src/world/terrain/TerrainMap.js'

const config = {
  terrain: { width: 32, depth: 32, renderChunk: { halo: 1 } },
  biomes: {
    defaultBiome: 'forest',
    regions: [
      { id: 'forest', center: [0, 0], radius: 50, weight: 1 },
      { id: 'autumnForest', center: [145, 145], radius: 50, weight: 1 }
    ]
  }
}

const chunk = {
  key: '4:4',
  coord: { x: 4, z: 4 },
  origin: { x: 128, z: 128 },
  size: 32,
  halo: 1
}

function makeCells(width, depth, value) {
  return Array.from({ length: depth }, () =>
    Array.from({ length: width }, () => value)
  )
}

test('biome mask generation samples global world block coordinates including halo', () => {
  const generator = new BiomeMaskGenerator(config)
  const cells = generator.generate({ originX: 127, originZ: 127, width: 34, depth: 34 })

  assert.equal(cells[18][18].biomeId, 'autumnForest')
})

test('biome mask falls back to configured default biome', () => {
  const generator = new BiomeMaskGenerator(config)

  assert.deepEqual(generator.getCellBiome(500, 500), {
    biomeId: 'forest',
    weights: { forest: 1 }
  })
})

test('terrain map maps visible cells to halo samples and world blocks', () => {
  const biomeCell = { biomeId: 'forest', weights: { forest: 1 } }
  const surfaceCell = { height: 1 }
  const terrainMap = new TerrainMap({
    heightField: { width: 34, depth: 34, get: () => 0 },
    biomeCells: makeCells(34, 34, biomeCell),
    surfaceCells: makeCells(34, 34, surfaceCell),
    chunk,
    visible: { x: 1, z: 1, width: 32, depth: 32 }
  })

  assert.deepEqual(terrainMap.toSampleCell(0, 0), { x: 1, z: 1 })
  assert.deepEqual(terrainMap.toSampleCell(-1, 0), { x: 0, z: 1 })
  assert.deepEqual(terrainMap.toWorldBlock(17, 17), { x: 145, z: 145 })
  assert.equal(terrainMap.hasCell(-1, 0), true)
  assert.equal(terrainMap.hasCell(-2, 0), false)
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- test/globalBiomeMask.test.js
```

Expected: FAIL because `generate()` does not accept origin/halo options and `TerrainMap` does not expose `toWorldBlock()`, `toSampleCell()`, or `hasCell()`.

- [ ] **Step 3: Update `BiomeMaskGenerator`**

In `src/world/biomes/BiomeMaskGenerator.js`, replace `generate()` with:

```js
  generate(options = {}) {
    const terrain = this.config.terrain
    const width = options.width ?? terrain.width
    const depth = options.depth ?? terrain.depth
    const originX = options.originX ?? 0
    const originZ = options.originZ ?? 0
    const cells = []

    for (let z = 0; z < depth; z++) {
      const row = []
      for (let x = 0; x < width; x++) {
        row.push(this.getCellBiome(originX + x, originZ + z))
      }
      cells.push(row)
    }

    return cells
  }
```

In `getCellBiome()`, replace the hard-coded forest fallback with:

```js
    const defaultBiome = this.config.biomes.defaultBiome ?? 'forest'
    if (scores.length === 0) {
      return { biomeId: defaultBiome, weights: { [defaultBiome]: 1 } }
    }
```

- [ ] **Step 4: Update `TerrainGenerator`**

In `src/world/terrain/TerrainGenerator.js`, change `generate()` to accept chunk options:

```js
  generate(options = {}) {
    const originX = options.originX ?? 0
    const originZ = options.originZ ?? 0
    const visibleWidth = options.width ?? this.config.terrain.width
    const visibleDepth = options.depth ?? this.config.terrain.depth
    const halo = options.halo ?? this.config.terrain.renderChunk?.halo ?? 0
    const sampleOriginX = originX - halo
    const sampleOriginZ = originZ - halo
    const sampleWidth = visibleWidth + halo * 2
    const sampleDepth = visibleDepth + halo * 2
    const chunk = options.chunk ?? null

    this.noise2D = createNoise2D(mulberry32(this.config.seed))
    const biomeCells = this.biomeMaskGenerator.generate({
      originX: sampleOriginX,
      originZ: sampleOriginZ,
      width: sampleWidth,
      depth: sampleDepth
    })
    const heightField = this.generateHeightField(biomeCells, {
      originX: sampleOriginX,
      originZ: sampleOriginZ,
      width: sampleWidth,
      depth: sampleDepth
    })
    const surfaceCells = this.surfaceClassifier.classify(heightField)
    this.volcanoSurfaceFeatureGenerator.apply(biomeCells, surfaceCells, {
      originX: sampleOriginX,
      originZ: sampleOriginZ
    })
    return new TerrainMap({
      heightField,
      biomeCells,
      surfaceCells,
      chunk: chunk ? { ...chunk, halo } : null,
      visible: { x: halo, z: halo, width: visibleWidth, depth: visibleDepth }
    })
  }
```

Change `generateHeightField(biomeCells)` to:

```js
  generateHeightField(biomeCells, options = {}) {
    const terrain = this.config.terrain
    const width = options.width ?? terrain.width
    const depth = options.depth ?? terrain.depth
    const originX = options.originX ?? 0
    const originZ = options.originZ ?? 0
    const field = new HeightField(width, depth)

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const biomeCell = biomeCells[z][x]
        const heightOffset = this.biomeBlender.blendTerrainParam(biomeCell.weights, 'heightOffset', 0)
        const heightMagnitude = this.biomeBlender.blendTerrainParam(biomeCell.weights, 'heightMagnitude', 1)

        const n01 = 0.5 + 0.5 * this.fbm(originX + x, originZ + z)
        const shaped = Math.max(0, Math.min(1, (n01 - terrain.seaClip) / (1 - terrain.seaClip)))
        const height = Math.floor(shaped * terrain.maxHeight * heightMagnitude + terrain.waterLevel + heightOffset)

        field.set(x, z, Math.max(0, Math.min(terrain.maxHeight, height)))
      }
    }

    return field
  }
```

In `src/world/terrain/SurfaceClassifier.js`, derive loop bounds from the generated field, not from `config.terrain`, so halo samples are classified too:

```js
    const { waterLevel } = this.config.terrain
    const { width, depth } = heightField
```

In `src/world/terrain/VolcanoSurfaceFeatureGenerator.js`, change `apply()` to accept `options = {}` and derive loop bounds from `biomeCells`/`surfaceCells` instead of `config.terrain`. When calling `isPoolCell`, pass global sample coordinates so lava pool noise does not repeat per chunk:

```js
    const depth = surfaceCells.length
    const width = surfaceCells[0]?.length ?? 0
    const originX = options.originX ?? 0
    const originZ = options.originZ ?? 0
```

Then use `this.isPoolCell(originX + x, originZ + z, lavaConfig)`.

Also update `assignPoolHeights(surfaceCells)` to derive `width` and `depth` from `surfaceCells`, not from `config.terrain`, so the halo participates in local lava continuity checks.

- [ ] **Step 5: Update `TerrainMap`**

In `src/world/terrain/TerrainMap.js`, change the constructor to:

```js
  constructor({ heightField, biomeCells, surfaceCells, chunk = null, visible = null }) {
    this.heightField = heightField
    this.biomeCells = biomeCells
    this.surfaceCells = surfaceCells
    this.chunk = chunk
    this.visible = visible ?? {
      x: 0,
      z: 0,
      width: heightField.width,
      depth: heightField.depth
    }
    this.width = this.visible.width
    this.depth = this.visible.depth
    this.sampleWidth = heightField.width
    this.sampleDepth = heightField.depth
  }
```

Change `getHeight()`, `getBiomeCell()`, and `getSurfaceCell()` to read through visible-local coordinates, then add:

```js
  toSampleCell(x, z) {
    return {
      x: this.visible.x + x,
      z: this.visible.z + z
    }
  }

  hasCell(x, z) {
    const sample = this.toSampleCell(x, z)
    return sample.x >= 0 &&
      sample.z >= 0 &&
      sample.x < this.sampleWidth &&
      sample.z < this.sampleDepth
  }

  getHeight(x, z) {
    const sample = this.toSampleCell(x, z)
    return this.heightField.get(sample.x, sample.z)
  }

  getBiomeCell(x, z) {
    const sample = this.toSampleCell(x, z)
    return this.biomeCells[sample.z]?.[sample.x]
  }

  getSurfaceCell(x, z) {
    const sample = this.toSampleCell(x, z)
    return this.surfaceCells[sample.z]?.[sample.x]
  }

  toWorldBlock(x, z) {
    const origin = this.chunk?.origin ?? { x: 0, z: 0 }
    return {
      x: origin.x + x,
      z: origin.z + z
    }
  }
```

- [ ] **Step 6: Make terrain placement and AO use visible bounds with halo neighbors**

In `src/world/terrain/LayeredTerrainBuilder.js`, use `terrainMap.width`/`terrainMap.depth` for the visible render area and `terrainMap.hasCell()` for neighbor availability:

```js
    const { waterLevel } = this.config.terrain
    const { width, depth } = terrainMap

    const effectiveHeight = (x, z, lavaAware = false) => {
      if (!terrainMap.hasCell(x, z)) {
        return -1
      }
      const surfaceCell = terrainMap.getSurfaceCell(x, z)
      if (lavaAware && surfaceCell?.isLava) {
        return surfaceCell.lavaHeight ?? surfaceCell.height
      }

      const h = terrainMap.getHeight(x, z)
      return h <= waterLevel ? waterLevel : h
    }
```

Before `placements.push(...)`, keep world metadata:

```js
          const worldBlock = terrainMap.toWorldBlock
            ? terrainMap.toWorldBlock(x, z)
            : { x, z }
```

Then include world coordinates:

```js
          placements.push({
            x,
            y,
            z,
            worldX: worldBlock.x,
            worldZ: worldBlock.z,
            layer,
            biomeCell: placementBiomeCell,
            surfaceCell
          })
```

Apply the same visible-bounds and `terrainMap.hasCell()` rule in `src/world/bricks/HeightfieldAO.js`. This prevents AO from treating chunk edges as height `-1` while still allowing the outermost visible cells to sample their halo neighbors.

In `src/world/bricks/WaterBrickRenderer.js`, `src/world/bricks/LavaBrickRenderer.js`, and `src/world/prefabs/PrefabPlacer.js`, replace visible loops based on `this.config.terrain.width`/`depth` with:

```js
    const { width, depth } = terrainMap
```

Keep transform positions in visible-local chunk coordinates (`0..31`) so `RenderChunk.group.position` supplies the world offset. Use `terrainMap.toWorldBlock(x, z)` only for deterministic world-space decisions such as prefab random seeds or biome/world metadata; do not use world coordinates for local mesh placement.

- [ ] **Step 7: Verify global biome tests pass**

Run:

```bash
npm test -- test/globalBiomeMask.test.js
```

Expected: PASS.

- [ ] **Step 8: Run related existing tests**

Run:

```bash
npm test -- test/lavaRendering.test.js test/volcanoSurfaceFeatureGenerator.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -- src/world/biomes/BiomeMaskGenerator.js src/world/terrain/TerrainGenerator.js src/world/terrain/TerrainMap.js src/world/terrain/SurfaceClassifier.js src/world/terrain/VolcanoSurfaceFeatureGenerator.js src/world/terrain/LayeredTerrainBuilder.js src/world/bricks/HeightfieldAO.js src/world/bricks/WaterBrickRenderer.js src/world/bricks/LavaBrickRenderer.js src/world/prefabs/PrefabPlacer.js test/globalBiomeMask.test.js
git commit -m "feat: sample terrain biomes in global coordinates"
```

---

### Task 4: Implement Debounced ChunkManager

**Files:**
- Create: `src/world/chunks/ChunkManager.js`
- Create: `test/chunkManager.test.js`

- [ ] **Step 1: Write the failing chunk manager tests**

Create `test/chunkManager.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import ChunkManager from '../src/world/chunks/ChunkManager.js'

const config = {
  size: 32,
  activeRadius: 1,
  hysteresisCells: 4,
  dwellSeconds: 0.25
}

test('initializes a 3x3 active window around current chunk', () => {
  const manager = new ChunkManager(config)
  const result = manager.update({ x: 10, z: 10 }, 0.016)

  assert.equal(result.anchorKey, '0:0')
  assert.equal(result.activeKeys.length, 9)
  assert.equal(result.changed, true)
})

test('does not switch anchor for shallow boundary jitter', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 31, z: 10 }, 0.016)

  const result = manager.update({ x: 33, z: 10 }, 0.016)

  assert.equal(result.anchorKey, '0:0')
  assert.equal(result.changed, false)
})

test('switches anchor after moving far enough into candidate chunk', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 31, z: 10 }, 0.016)

  const result = manager.update({ x: 36, z: 10 }, 0.016)

  assert.equal(result.anchorKey, '1:0')
  assert.equal(result.changed, true)
})

test('switches anchor after candidate remains stable for dwell time', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 31, z: 10 }, 0.016)
  manager.update({ x: 33, z: 10 }, 0.10)
  manager.update({ x: 33, z: 10 }, 0.10)

  const result = manager.update({ x: 33, z: 10 }, 0.06)

  assert.equal(result.anchorKey, '1:0')
  assert.equal(result.changed, true)
})

test('does not rebuild active window when anchor is unchanged', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 10, z: 10 }, 0.016)

  const result = manager.update({ x: 12, z: 12 }, 0.016)

  assert.equal(result.changed, false)
  assert.deepEqual(result.loadKeys, [])
  assert.deepEqual(result.unloadKeys, [])
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- test/chunkManager.test.js
```

Expected: FAIL because `ChunkManager.js` does not exist.

- [ ] **Step 3: Implement `ChunkManager`**

Create `src/world/chunks/ChunkManager.js`:

```js
import {
  getActiveWindowKeys,
  getRenderChunkCoord,
  getRenderChunkKey
} from './chunkCoordinates.js'

export default class ChunkManager {
  constructor(config = {}) {
    this.size = config.size ?? 32
    this.activeRadius = config.activeRadius ?? 1
    this.hysteresisCells = config.hysteresisCells ?? 4
    this.dwellSeconds = config.dwellSeconds ?? 0.25

    this.anchorCoord = null
    this.activeKeys = []
    this.candidateKey = null
    this.candidateSeconds = 0
  }

  update(worldBlock, deltaSeconds = 0) {
    const candidateCoord = getRenderChunkCoord(worldBlock.x, worldBlock.z, this.size)
    const candidateKey = getRenderChunkKey(candidateCoord)

    if (!this.anchorCoord) {
      return this.setAnchor(candidateCoord)
    }

    const anchorKey = getRenderChunkKey(this.anchorCoord)
    if (candidateKey === anchorKey) {
      this.candidateKey = null
      this.candidateSeconds = 0
      return this.makeResult(false, [], [])
    }

    if (this.candidateKey === candidateKey) {
      this.candidateSeconds += Math.max(0, deltaSeconds)
    } else {
      this.candidateKey = candidateKey
      this.candidateSeconds = Math.max(0, deltaSeconds)
    }

    if (this.isPastHysteresis(worldBlock, candidateCoord) || this.candidateSeconds >= this.dwellSeconds) {
      return this.setAnchor(candidateCoord)
    }

    return this.makeResult(false, [], [])
  }

  isPastHysteresis(worldBlock, candidateCoord) {
    const localX = worldBlock.x - candidateCoord.x * this.size
    const localZ = worldBlock.z - candidateCoord.z * this.size

    if (candidateCoord.x !== this.anchorCoord.x && localX >= this.hysteresisCells && localX < this.size - this.hysteresisCells) {
      return true
    }
    if (candidateCoord.z !== this.anchorCoord.z && localZ >= this.hysteresisCells && localZ < this.size - this.hysteresisCells) {
      return true
    }
    return false
  }

  setAnchor(coord) {
    const previous = new Set(this.activeKeys)
    this.anchorCoord = { ...coord }
    this.candidateKey = null
    this.candidateSeconds = 0
    this.activeKeys = getActiveWindowKeys(this.anchorCoord, this.activeRadius)

    const next = new Set(this.activeKeys)
    const loadKeys = this.activeKeys.filter((key) => !previous.has(key))
    const unloadKeys = [...previous].filter((key) => !next.has(key))

    return this.makeResult(true, loadKeys, unloadKeys)
  }

  makeResult(changed, loadKeys, unloadKeys) {
    return {
      changed,
      anchorCoord: this.anchorCoord ? { ...this.anchorCoord } : null,
      anchorKey: this.anchorCoord ? getRenderChunkKey(this.anchorCoord) : null,
      activeKeys: [...this.activeKeys],
      loadKeys,
      unloadKeys
    }
  }
}
```

- [ ] **Step 4: Verify chunk manager tests pass**

Run:

```bash
npm test -- test/chunkManager.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/world/chunks/ChunkManager.js test/chunkManager.test.js
git commit -m "feat: add debounced chunk manager"
```

---

### Task 5: Add ProgressState

**Files:**
- Create: `src/world/progression/ProgressState.js`
- Create: `test/progressState.test.js`

- [ ] **Step 1: Write the failing progress tests**

Create `test/progressState.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import ProgressState from '../src/world/progression/ProgressState.js'

test('records confirmed and discovered biomes once', () => {
  const state = new ProgressState()

  assert.equal(state.confirmBiome('volcano'), true)
  assert.equal(state.confirmBiome('volcano'), false)
  assert.equal(state.discoverBiome('volcano'), true)
  assert.equal(state.discoverBiome('volcano'), false)

  assert.deepEqual([...state.confirmedBiomeIds], ['volcano'])
  assert.deepEqual([...state.discoveredBiomeIds], ['volcano'])
})

test('unlocks achievements once', () => {
  const state = new ProgressState()

  assert.equal(state.unlockAchievement('biome_volcano_discovered'), true)
  assert.equal(state.unlockAchievement('biome_volcano_discovered'), false)
})

test('activates only current-order ruins', () => {
  const state = new ProgressState()

  assert.equal(state.canActivateStoryOrder(1), false)
  assert.equal(state.canActivateStoryOrder(0), true)
  assert.equal(state.activateRuin('forest_ruin'), true)
  assert.equal(state.viewStory('forest_comic'), true)
  state.advanceStory()

  assert.equal(state.currentStoryIndex, 1)
  assert.equal(state.canActivateStoryOrder(1), true)
})

test('detects all-biomes-complete from discovered ids', () => {
  const state = new ProgressState()
  state.discoverBiome('forest')
  state.discoverBiome('volcano')

  assert.equal(state.areAllBiomesDiscovered(['forest', 'volcano']), true)
  assert.equal(state.areAllBiomesDiscovered(['forest', 'desert', 'volcano']), false)
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- test/progressState.test.js
```

Expected: FAIL because `ProgressState.js` does not exist.

- [ ] **Step 3: Implement `ProgressState`**

Create `src/world/progression/ProgressState.js`:

```js
export default class ProgressState {
  constructor() {
    this.confirmedBiomeIds = new Set()
    this.discoveredBiomeIds = new Set()
    this.unlockedAchievementIds = new Set()
    this.activatedRuinIds = new Set()
    this.viewedStoryIds = new Set()
    this.currentStoryIndex = 0
  }

  addOnce(set, id) {
    if (!id || set.has(id)) {
      return false
    }
    set.add(id)
    return true
  }

  confirmBiome(id) {
    return this.addOnce(this.confirmedBiomeIds, id)
  }

  discoverBiome(id) {
    return this.addOnce(this.discoveredBiomeIds, id)
  }

  unlockAchievement(id) {
    return this.addOnce(this.unlockedAchievementIds, id)
  }

  activateRuin(id) {
    return this.addOnce(this.activatedRuinIds, id)
  }

  viewStory(id) {
    return this.addOnce(this.viewedStoryIds, id)
  }

  canActivateStoryOrder(storyOrder) {
    return storyOrder === this.currentStoryIndex
  }

  advanceStory() {
    this.currentStoryIndex += 1
  }

  areAllBiomesDiscovered(biomeIds) {
    return biomeIds.every((id) => this.discoveredBiomeIds.has(id))
  }
}
```

- [ ] **Step 4: Verify progress tests pass**

Run:

```bash
npm test -- test/progressState.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/world/progression/ProgressState.js test/progressState.test.js
git commit -m "feat: add biome progress state"
```

---

### Task 6: Add BiomeRouteService

**Files:**
- Create: `src/world/biomes/BiomeRouteService.js`
- Create: `test/biomeRouteService.test.js`

- [ ] **Step 1: Write the failing route service tests**

Create `test/biomeRouteService.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import BiomeRouteService from '../src/world/biomes/BiomeRouteService.js'
import ProgressState from '../src/world/progression/ProgressState.js'

const config = {
  defaultBiome: 'forest',
  achievementRadius: 40,
  ruinActivationRadius: 5,
  regions: [
    {
      id: 'forest',
      displayName: 'Forest',
      center: [0, 0],
      radius: 50,
      achievementRadius: 40,
      storyOrder: 0,
      discoveryAchievementId: 'biome_forest_discovered',
      ruinId: 'forest_ruin',
      storyId: 'forest_comic'
    },
    {
      id: 'volcano',
      displayName: 'Volcano',
      center: [100, 0],
      radius: 50,
      achievementRadius: 40,
      storyOrder: 1,
      discoveryAchievementId: 'biome_volcano_discovered',
      ruinId: 'volcano_ruin',
      storyId: 'volcano_comic'
    }
  ]
}

test('sorts route regions by story order', () => {
  const service = new BiomeRouteService({
    ...config,
    regions: [config.regions[1], config.regions[0]]
  })

  assert.deepEqual(service.routeRegions.map((region) => region.id), ['forest', 'volcano'])
})

test('resolves confirmed biome only inside achievement radius', () => {
  const service = new BiomeRouteService(config)

  assert.equal(service.resolveConfirmedBiome({ x: 39, z: 0 })?.id, 'forest')
  assert.equal(service.resolveConfirmedBiome({ x: 45, z: 0 }), null)
})

test('discovers and unlocks later biomes out of order', () => {
  const service = new BiomeRouteService(config)
  const progress = new ProgressState()
  const events = service.update({ x: 100, z: 0 }, progress)

  assert.deepEqual(events.map((event) => event.type), [
    'biome:changed',
    'biome:confirmed',
    'biome:discovered',
    'achievement:unlocked',
    'ruin:blocked'
  ])
  assert.equal(progress.discoveredBiomeIds.has('volcano'), true)
  assert.equal(progress.unlockedAchievementIds.has('biome_volcano_discovered'), true)
  assert.equal(progress.currentStoryIndex, 0)
})

test('activates current-order ruin and advances story', () => {
  const service = new BiomeRouteService(config)
  const progress = new ProgressState()
  const events = service.update({ x: 0, z: 0 }, progress)

  assert.equal(events.some((event) => event.type === 'ruin:activated'), true)
  assert.equal(progress.currentStoryIndex, 1)
  assert.equal(progress.activatedRuinIds.has('forest_ruin'), true)
  assert.equal(progress.viewedStoryIds.has('forest_comic'), true)
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- test/biomeRouteService.test.js
```

Expected: FAIL because `BiomeRouteService.js` does not exist.

- [ ] **Step 3: Implement `BiomeRouteService`**

Create `src/world/biomes/BiomeRouteService.js`:

```js
function distanceToCenter(position, region) {
  const dx = position.x - region.center[0]
  const dz = position.z - region.center[1]
  return Math.sqrt(dx * dx + dz * dz)
}

function normalizeRegion(region, index, defaults) {
  return {
    ...region,
    displayName: region.displayName ?? region.id,
    storyOrder: Number.isInteger(region.storyOrder) ? region.storyOrder : index,
    achievementRadius: region.achievementRadius ?? defaults.achievementRadius ?? 40,
    ruinActivationRadius: region.ruinActivationRadius ?? defaults.ruinActivationRadius ?? 5
  }
}

export default class BiomeRouteService {
  constructor(config = {}) {
    this.config = config
    this.routeRegions = (config.regions ?? [])
      .map((region, index) => normalizeRegion(region, index, config))
      .sort((a, b) => a.storyOrder - b.storyOrder)
    this.currentVisualBiomeId = null
  }

  update(position, progress) {
    const events = []
    const currentVisualBiome = this.resolveCurrentVisualBiome(position)
    if (currentVisualBiome?.id !== this.currentVisualBiomeId) {
      this.currentVisualBiomeId = currentVisualBiome?.id ?? null
      if (currentVisualBiome) {
        events.push({ type: 'biome:changed', region: currentVisualBiome })
      }
    }

    const confirmedBiome = this.resolveConfirmedBiome(position)
    if (confirmedBiome) {
      if (progress.confirmBiome(confirmedBiome.id)) {
        events.push({ type: 'biome:confirmed', region: confirmedBiome })
      }
      if (progress.discoverBiome(confirmedBiome.id)) {
        events.push({ type: 'biome:discovered', region: confirmedBiome })
        if (progress.unlockAchievement(confirmedBiome.discoveryAchievementId)) {
          events.push({
            type: 'achievement:unlocked',
            discoveryAchievementId: confirmedBiome.discoveryAchievementId,
            region: confirmedBiome
          })
        }
      }
    }

    const ruinRegion = this.resolveRuinRegion(position)
    if (ruinRegion) {
      if (progress.canActivateStoryOrder(ruinRegion.storyOrder)) {
        if (progress.activateRuin(ruinRegion.ruinId)) {
          progress.viewStory(ruinRegion.storyId)
          progress.advanceStory()
          events.push({ type: 'ruin:activated', region: ruinRegion })
        }
      } else {
        events.push({ type: 'ruin:blocked', region: ruinRegion })
      }
    }

    if (progress.areAllBiomesDiscovered(this.routeRegions.map((region) => region.id))) {
      events.push({ type: 'biomes:complete' })
    }

    return events
  }

  resolveCurrentVisualBiome(position) {
    const matches = this.routeRegions
      .map((region) => ({ region, distance: distanceToCenter(position, region) }))
      .filter((entry) => entry.distance <= entry.region.radius)
      .sort((a, b) => a.distance - b.distance)
    return matches[0]?.region ?? null
  }

  resolveConfirmedBiome(position) {
    const matches = this.routeRegions
      .map((region) => ({ region, distance: distanceToCenter(position, region) }))
      .filter((entry) => entry.distance <= entry.region.achievementRadius)
      .sort((a, b) => a.distance - b.distance)
    return matches[0]?.region ?? null
  }

  resolveRuinRegion(position) {
    return this.routeRegions.find((region) => distanceToCenter(position, region) <= region.ruinActivationRadius) ?? null
  }

  getNextStoryTarget(progress) {
    return this.routeRegions.find((region) => region.storyOrder === progress.currentStoryIndex) ?? null
  }
}
```

- [ ] **Step 4: Verify route service tests pass**

Run:

```bash
npm test -- test/biomeRouteService.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/world/biomes/BiomeRouteService.js test/biomeRouteService.test.js
git commit -m "feat: add authored biome route service"
```

---

### Task 7: Add Runtime BiomeStoryController

**Files:**
- Create: `src/world/story/BiomeStoryController.js`
- Modify: `src/world/world.js`
- Create: `test/biomeStoryController.test.js`

- [ ] **Step 1: Write the failing controller tests**

Create `test/biomeStoryController.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import BiomeStoryController from '../src/world/story/BiomeStoryController.js'

function createExperience() {
  const emitted = []
  return {
    eventBus: {
      emit(type, payload) {
        emitted.push({ type, payload })
      }
    },
    world: {
      playerAircraft: {
        state: {
          position: new THREE.Vector3(0, 3, 0)
        }
      }
    },
    config: {
      terrain: {
        cellSize: 0.2
      },
      biomes: {
        achievementRadius: 40,
        ruinActivationRadius: 5,
        regions: [
          {
            id: 'forest',
            displayName: 'Forest',
            center: [0, 0],
            radius: 50,
            achievementRadius: 40,
            storyOrder: 0,
            discoveryAchievementId: 'biome_forest_discovered',
            ruinId: 'forest_ruin',
            storyId: 'forest_comic'
          }
        ]
      }
    },
    emitted
  }
}

test('converts aircraft world units to world blocks and emits route events', () => {
  const experience = createExperience()
  const controller = new BiomeStoryController(experience)

  controller.update()

  assert.equal(experience.emitted.some((event) => event.type === 'biome:confirmed'), true)
  assert.equal(experience.emitted.some((event) => event.type === 'achievement:unlocked'), true)
  assert.equal(experience.emitted.some((event) => event.type === 'ruin:activated'), true)
})

test('skips update when player aircraft is missing', () => {
  const experience = createExperience()
  experience.world.playerAircraft = null
  const controller = new BiomeStoryController(experience)

  controller.update()

  assert.deepEqual(experience.emitted, [])
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- test/biomeStoryController.test.js
```

Expected: FAIL because `BiomeStoryController.js` does not exist.

- [ ] **Step 3: Implement `BiomeStoryController`**

Create `src/world/story/BiomeStoryController.js`:

```js
import * as THREE from 'three/webgpu'
import { eventBus as defaultEventBus } from '../../utils/event-bus.js'
import BiomeRouteService from '../biomes/BiomeRouteService.js'
import ProgressState from '../progression/ProgressState.js'

export default class BiomeStoryController {
  constructor(experience, options = {}) {
    this.experience = experience
    this.config = options.config ?? experience.config ?? {}
    this.eventBus = options.eventBus ?? experience.eventBus ?? defaultEventBus
    this.routeService = options.routeService ?? new BiomeRouteService(this.config.biomes)
    this.progress = options.progress ?? new ProgressState()
    this.group = new THREE.Group()
    this.group.name = 'BiomeStoryController'
    this.markerGeometry = null
    this.markerMaterial = null
    this.ruinMarkers = []
    this.buildRuinMarkers()
  }

  buildRuinMarkers() {
    const cellSize = this.config.terrain?.cellSize ?? 1
    this.markerGeometry = new THREE.CylinderGeometry(0.25, 0.35, 0.5, 6)
    this.markerMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1a8 })

    for (const region of this.routeService.routeRegions) {
      const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial)
      marker.name = `RuinMarker:${region.ruinId}`
      marker.position.set(region.center[0] * cellSize, 0.5, region.center[1] * cellSize)
      this.group.add(marker)
      this.ruinMarkers.push(marker)
    }
  }

  update() {
    const playerPosition = this.experience.world?.playerAircraft?.state?.position
    if (!playerPosition) {
      return
    }

    const cellSize = this.config.terrain?.cellSize ?? 1
    const worldBlock = {
      x: playerPosition.x / cellSize,
      z: playerPosition.z / cellSize
    }
    const events = this.routeService.update(worldBlock, this.progress)
    const nextTarget = this.routeService.getNextStoryTarget(this.progress)

    for (const event of events) {
      this.eventBus.emit(event.type, {
        ...event,
        nextTarget
      })
    }
  }

  dispose() {
    this.markerGeometry?.dispose()
    this.markerMaterial?.dispose()
    this.markerGeometry = null
    this.markerMaterial = null
    this.group.parent?.remove(this.group)
    this.group.clear()
    this.ruinMarkers = []
  }
}
```

- [ ] **Step 4: Verify controller tests pass**

Run:

```bash
npm test -- test/biomeStoryController.test.js
```

Expected: PASS.

- [ ] **Step 5: Wire controller into `World` after chunk streaming is stable**

Only do this after Task 10 has passed manual chunk-boundary verification.

In `src/world/world.js`, add:

```js
import BiomeStoryController from './story/BiomeStoryController.js'
```

In the constructor, keep:

```js
        this.biomeStoryController = null
```

In `build()`, after shared generation systems and `ChunkManager` are initialized, add:

```js
            this.biomeStoryController = new BiomeStoryController(this.experience, { config: this.config })
            this.addSystem(this.biomeStoryController)
```

If `BiomeStoryController` needs newest chunk state later, do not add it to `children`; call it manually after `updateRenderChunks()` instead.

- [ ] **Step 6: Commit**

```bash
git add -- src/world/story/BiomeStoryController.js src/world/world.js test/biomeStoryController.test.js
git commit -m "feat: add biome story controller"
```

---

### Task 8: Add GameHUD

**Files:**
- Create: `src/ui/GameHUD.js`
- Create: `test/gameHUD.test.js`
- Modify: `src/style.css`
- Modify: `src/app/Experience.js`

- [ ] **Step 1: Write the failing HUD test**

Create `test/gameHUD.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import GameHUD from '../src/ui/GameHUD.js'

function createEventBus() {
  const handlers = new Map()
  return {
    on(type, handler) {
      handlers.set(type, handler)
    },
    off(type, handler) {
      if (handlers.get(type) === handler) {
        handlers.delete(type)
      }
    },
    emit(type, payload) {
      handlers.get(type)?.(payload)
    },
    get size() {
      return handlers.size
    }
  }
}

function createDocument() {
  const body = {
    children: [],
    append(node) {
      this.children.push(node)
      node.parent = this
    }
  }
  return {
    body,
    createElement() {
      return {
        className: '',
        textContent: '',
        children: [],
        parent: null,
        append(...nodes) {
          this.children.push(...nodes)
        },
        remove() {
          if (this.parent) {
            this.parent.children = this.parent.children.filter((child) => child !== this)
          }
        }
      }
    }
  }
}

test('updates HUD text from biome route events', () => {
  const eventBus = createEventBus()
  const documentRef = createDocument()
  const hud = new GameHUD({ eventBus, documentRef })

  eventBus.emit('biome:confirmed', {
    region: { displayName: 'Volcano' },
    nextTarget: { displayName: 'Forest' }
  })

  assert.equal(hud.messageEl.textContent, 'Confirmed Volcano')
  assert.equal(hud.nextEl.textContent, 'Next signal: Forest')
})

test('disposes event handlers and DOM root', () => {
  const eventBus = createEventBus()
  const documentRef = createDocument()
  const hud = new GameHUD({ eventBus, documentRef })

  hud.dispose()

  assert.equal(eventBus.size, 0)
  assert.equal(documentRef.body.children.length, 0)
})
```

- [ ] **Step 2: Run the failing HUD test**

Run:

```bash
npm test -- test/gameHUD.test.js
```

Expected: FAIL because `GameHUD.js` does not exist.

- [ ] **Step 3: Create DOM HUD class**

Create `src/ui/GameHUD.js`:

```js
import { eventBus as defaultEventBus } from '../utils/event-bus.js'

export default class GameHUD {
  constructor({ eventBus = defaultEventBus, documentRef = globalThis.document } = {}) {
    this.eventBus = eventBus
    this.document = documentRef
    this.root = null
    this.messageEl = null
    this.nextEl = null
    this.unsubscribers = []

    if (!this.document?.body) {
      return
    }

    this.build()
    this.subscribe()
  }

  build() {
    this.root = this.document.createElement('div')
    this.root.className = 'game-hud'
    this.messageEl = this.document.createElement('div')
    this.messageEl.className = 'game-hud__message'
    this.nextEl = this.document.createElement('div')
    this.nextEl.className = 'game-hud__next'
    this.root.append(this.messageEl, this.nextEl)
    this.document.body.append(this.root)
  }

  subscribe() {
    this.on('biome:confirmed', ({ region, nextTarget }) => {
      this.setMessage(`Confirmed ${region.displayName}`)
      this.setNextTarget(nextTarget)
    })
    this.on('achievement:unlocked', ({ region, nextTarget }) => {
      this.setMessage(`${region.displayName} Discovered`)
      this.setNextTarget(nextTarget)
    })
    this.on('ruin:blocked', ({ nextTarget }) => {
      this.setMessage('Signal not synchronized. More clues are still missing.')
      this.setNextTarget(nextTarget)
    })
    this.on('ruin:activated', ({ region, nextTarget }) => {
      this.setMessage(`${region.displayName} story restored`)
      this.setNextTarget(nextTarget)
    })
    this.on('biomes:complete', () => {
      this.setMessage('All biomes discovered')
      this.setNextTarget(null)
    })
  }

  on(type, handler) {
    this.eventBus.on(type, handler)
    this.unsubscribers.push(() => this.eventBus.off(type, handler))
  }

  setMessage(message) {
    if (this.messageEl) {
      this.messageEl.textContent = message
    }
  }

  setNextTarget(region) {
    if (this.nextEl) {
      this.nextEl.textContent = region ? `Next signal: ${region.displayName}` : ''
    }
  }

  dispose() {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe()
    }
    this.unsubscribers = []
    this.root?.remove()
    this.root = null
    this.messageEl = null
    this.nextEl = null
  }
}
```

- [ ] **Step 4: Add HUD styles**

Append to `src/style.css`:

```css
.game-hud
{
    position: fixed;
    z-index: 2;
    left: 1rem;
    bottom: 1rem;
    min-width: 14rem;
    max-width: min(22rem, calc(100vw - 2rem));
    padding: 0.75rem 0.875rem;
    font-family: system-ui, sans-serif;
    color: #f7f3e8;
    background: rgba(18, 24, 28, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 6px;
    pointer-events: none;
}

.game-hud__message
{
    font-size: 0.875rem;
    line-height: 1.35;
}

.game-hud__next
{
    margin-top: 0.35rem;
    font-size: 0.75rem;
    line-height: 1.3;
    color: rgba(247, 243, 232, 0.72);
}
```

- [ ] **Step 5: Wire HUD into `Experience`**

In `src/app/Experience.js`, add:

```js
import GameHUD from '../ui/GameHUD.js'
```

In the constructor, after `this.world = new World(this)`:

```js
        this.eventBus = eventBus
        this.gameHUD = null
```

Also import the event bus:

```js
import { eventBus } from '../utils/event-bus.js'
```

In `init()`, after `this.world.build()`:

```js
        this.gameHUD = new GameHUD({ eventBus: this.eventBus })
```

In `dispose()`, before `this.world.dispose()`:

```js
        this.gameHUD?.dispose()
        this.gameHUD = null
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm test -- test/gameHUD.test.js
npm test
npm run build
```

Expected: PASS. Existing Vite large-chunk warnings are acceptable.

- [ ] **Step 7: Commit**

```bash
git add -- src/ui/GameHUD.js src/style.css src/app/Experience.js test/gameHUD.test.js
git commit -m "feat: add biome route HUD"
```

---

### Task 9: Add RenderChunk Wrapper

**Files:**
- Create: `src/world/chunks/RenderChunk.js`
- Create: `test/renderChunk.test.js`

- [ ] **Step 1: Write the failing RenderChunk test**

Create `test/renderChunk.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import RenderChunk from '../src/world/chunks/RenderChunk.js'

function createRenderer(name) {
  return {
    group: new THREE.Group(),
    builtWith: null,
    build(input) {
      this.builtWith = input
      this.group.name = name
      return this.group
    },
    disposeCalled: false,
    dispose() {
      this.disposeCalled = true
    }
  }
}

test('positions chunk root at render chunk world offset', () => {
  const renderers = {
    terrain: createRenderer('terrain'),
    water: createRenderer('water'),
    lava: createRenderer('lava'),
    prefabs: createRenderer('prefabs')
  }
  const chunk = new RenderChunk({
    key: '4:4',
    coord: { x: 4, z: 4 },
    origin: { x: 128, z: 128 },
    size: 32,
    cellSize: 0.2,
    renderers
  })

  assert.equal(chunk.group.position.x, 25.6)
  assert.equal(chunk.group.position.z, 25.6)
})

test('dispose forwards to owned renderers', () => {
  const renderers = {
    terrain: createRenderer('terrain'),
    water: createRenderer('water'),
    lava: createRenderer('lava'),
    prefabs: createRenderer('prefabs')
  }
  const chunk = new RenderChunk({
    key: '4:4',
    coord: { x: 4, z: 4 },
    origin: { x: 128, z: 128 },
    size: 32,
    cellSize: 0.2,
    renderers
  })

  chunk.dispose()

  assert.equal(renderers.terrain.disposeCalled, true)
  assert.equal(renderers.water.disposeCalled, true)
  assert.equal(renderers.lava.disposeCalled, true)
  assert.equal(renderers.prefabs.disposeCalled, true)
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- test/renderChunk.test.js
```

Expected: FAIL because `RenderChunk.js` does not exist.

- [ ] **Step 3: Implement `RenderChunk`**

Create `src/world/chunks/RenderChunk.js`:

```js
import * as THREE from 'three/webgpu'

export default class RenderChunk {
  constructor({ key, coord, origin, size, cellSize, renderers }) {
    this.key = key
    this.coord = coord
    this.origin = origin
    this.size = size
    this.renderers = renderers
    this.group = new THREE.Group()
    this.group.name = `RenderChunk:${key}`
    this.group.position.set(origin.x * cellSize, 0, origin.z * cellSize)
  }

  build({ terrainMap, placements, colorResolver, heightfieldAO }) {
    this.group.add(this.renderers.terrain.build(placements, colorResolver, heightfieldAO))
    this.group.add(this.renderers.water.build(terrainMap))
    this.group.add(this.renderers.lava.build(terrainMap))
    this.group.add(this.renderers.prefabs.build(terrainMap))
    return this.group
  }

  updateInstanceColors() {
    this.renderers.terrain.updateInstanceColors?.()
  }

  setPreviewVisible(preview) {
    if (this.renderers.water.group) {
      this.renderers.water.group.visible = !preview
    }
    if (this.renderers.lava.group) {
      this.renderers.lava.group.visible = !preview
    }
    if (this.renderers.prefabs.group) {
      this.renderers.prefabs.group.visible = !preview
    }
  }

  dispose() {
    for (const renderer of Object.values(this.renderers)) {
      renderer.dispose?.()
    }
    this.group.parent?.remove(this.group)
    this.group.clear()
  }
}
```

- [ ] **Step 4: Verify RenderChunk tests pass**

Run:

```bash
npm test -- test/renderChunk.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/world/chunks/RenderChunk.js test/renderChunk.test.js
git commit -m "feat: add render chunk wrapper"
```

---

### Task 10: Integrate Chunk Streaming Into World

**Files:**
- Modify: `src/world/world.js`

- [ ] **Step 1: Add imports to `world.js`**

Add:

```js
import ChunkManager from './chunks/ChunkManager.js'
import RenderChunk from './chunks/RenderChunk.js'
import {
    getRenderChunkOrigin,
    parseRenderChunkKey
} from './chunks/chunkCoordinates.js'
```

- [ ] **Step 2: Replace single renderer properties with chunk state**

In the constructor, keep shared systems such as `biomeRegistry`, `biomeBlender`, `biomeMaskGenerator`, `terrainGenerator`, `layeredTerrainBuilder`, `brickColorResolver`, and `brickGeometry`.

Add:

```js
        this.chunkManager = null
        this.renderChunks = new Map()
        this.biomeStoryController = null
```

Keep old renderer properties until the implementation is verified, then remove `terrainBrickRenderer`, `waterBrickRenderer`, `lavaBrickRenderer`, and `prefabPlacer` if no code references them.

- [ ] **Step 3: Initialize shared generation systems in `build()`**

In `build()`, after brick geometry is available, create shared services once:

```js
        if (!this.terrainGenerator) {
            this.biomeRegistry = new BiomeRegistry()
            this.biomeBlender = new BiomeBlender(this.biomeRegistry)
            this.biomeMaskGenerator = new BiomeMaskGenerator(this.config)
            this.terrainGenerator = new TerrainGenerator({
                config: this.config,
                biomeMaskGenerator: this.biomeMaskGenerator,
                biomeBlender: this.biomeBlender,
                biomeRegistry: this.biomeRegistry
            })
            this.layeredTerrainBuilder = new LayeredTerrainBuilder({ config: this.config })
            this.brickColorResolver = new BrickColorResolver({
                biomeRegistry: this.biomeRegistry,
                biomeBlender: this.biomeBlender,
                config: this.config
            })
            this.chunkManager = new ChunkManager(this.config.terrain.renderChunk)
        }
```

Keep existing `PlayerAircraft` creation. The player must be available before streaming updates run.

- [ ] **Step 4: Add `createRenderChunk(key)` method**

Add this method to `World`:

```js
    createRenderChunk(key) {
        const chunkConfig = this.config.terrain.renderChunk
        const coord = parseRenderChunkKey(key)
        const origin = getRenderChunkOrigin(coord, chunkConfig.size)
        const terrainMap = this.terrainGenerator.generate({
            originX: origin.x,
            originZ: origin.z,
            width: chunkConfig.size,
            depth: chunkConfig.size,
            halo: chunkConfig.halo ?? 0,
            chunk: {
                key,
                coord,
                origin,
                size: chunkConfig.size,
                halo: chunkConfig.halo ?? 0
            }
        })
        const placements = this.layeredTerrainBuilder.buildPlacements(terrainMap)
        const heightfieldAO = new HeightfieldAO({ config: this.config })
        heightfieldAO.build(terrainMap)

        const prefabRegistry = new PrefabRegistry(this.experience.resources)
        const renderChunk = new RenderChunk({
            key,
            coord,
            origin,
            size: chunkConfig.size,
            cellSize: this.config.terrain.cellSize,
            renderers: {
                terrain: new TerrainBrickRenderer({
                    config: this.config,
                    brickGeometry: this.brickGeometry
                }),
                water: new WaterBrickRenderer({
                    config: this.config,
                    brickGeometry: this.brickGeometry,
                    waterNoiseTexture: this.experience.resources.items.waterNoiseTexture
                }),
                lava: new LavaBrickRenderer({
                    config: this.config,
                    brickGeometry: this.brickGeometry,
                    lavaConfig: this.biomeRegistry.get('volcano').lava,
                    lavaNoiseTexture: this.experience.resources.items.lavaNoiseTexture
                }),
                prefabs: new PrefabPlacer({
                    config: this.config,
                    biomeRegistry: this.biomeRegistry,
                    prefabRegistry
                })
            }
        })

        renderChunk.build({
            terrainMap,
            placements,
            colorResolver: this.brickColorResolver,
            heightfieldAO
        })
        renderChunk.setPreviewVisible(this.config.terrain.ao?.previewGrayscale === true)
        this.renderChunks.set(key, renderChunk)
        this.group.add(renderChunk.group)
        return renderChunk
    }
```

- [ ] **Step 5: Add `updateRenderChunks()`**

Add:

```js
    updateRenderChunks() {
        const aircraft = this.playerAircraft
        if (!aircraft?.state?.position || !this.chunkManager) {
            return
        }

        const cellSize = this.config.terrain.cellSize
        const worldBlock = {
            x: aircraft.state.position.x / cellSize,
            z: aircraft.state.position.z / cellSize
        }
        const result = this.chunkManager.update(worldBlock, this.experience.time.getDelta())

        for (const key of result.unloadKeys) {
            const chunk = this.renderChunks.get(key)
            chunk?.dispose()
            this.renderChunks.delete(key)
        }

        for (const key of result.loadKeys) {
            if (!this.renderChunks.has(key)) {
                this.createRenderChunk(key)
            }
        }
    }
```

- [ ] **Step 6: Update `World.update()`**

Change `update()` to update the aircraft before streaming:

```js
    update() {
        for (const child of this.children) {
            child.update?.()
        }
        this.updateRenderChunks()
    }
```

- [ ] **Step 7: Update AO preview**

In `refreshAOPreview()`, replace single-renderer visibility with chunk iteration:

```js
        for (const chunk of this.renderChunks.values()) {
            chunk.updateInstanceColors()
            chunk.setPreviewVisible(preview)
        }
```

Keep player visibility:

```js
        if (this.playerAircraft?.group) {
            this.playerAircraft.group.visible = !preview
        }
```

- [ ] **Step 8: Update dispose**

Before clearing children:

```js
        for (const chunk of this.renderChunks.values()) {
            chunk.dispose()
        }
        this.renderChunks.clear()
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
npm test -- test/chunkCoordinates.test.js test/chunkManager.test.js test/globalBiomeMask.test.js test/renderChunk.test.js
```

Expected: PASS.

- [ ] **Step 10: Run full tests and build**

Run:

```bash
npm test
npm run build
```

Expected: PASS. Existing Vite large-chunk warnings are acceptable.

- [ ] **Step 11: Manual verification**

Run:

```bash
npm run dev
```

Verify:

- aircraft still appears and moves
- visible terrain follows the aircraft
- no visible flicker when moving back and forth around chunk boundaries
- no false vertical side walls appear on chunk edges
- AO does not darken or break at chunk edges
- water and cliff edges continue across chunk boundaries

- [ ] **Step 12: Commit**

```bash
git add -- src/world/world.js
git commit -m "feat: stream render chunks around aircraft"
```

---

### Task 11: Final Verification And Cleanup

**Files:**
- Inspect all files changed by Tasks 1-10.

- [ ] **Step 1: Check forbidden old chunk assumptions**

Run:

```bash
rg "at most two|two chunk|nearest target-side|128 x 128.*chunk|64 x 64" src test
```

Expected: no matches. Matches in historical specs are acceptable only if clearly labelled as old context, but there should be no runtime or implementation-plan dependency on those assumptions.

- [ ] **Step 2: Check visible chunk loops do not use global terrain dimensions**

Run:

```bash
rg "this\\.config\\.terrain\\.width|this\\.config\\.terrain\\.depth|config\\.terrain\\.width|config\\.terrain\\.depth|const \\{ width, depth.*config\\.terrain" src/world/bricks src/world/prefabs src/world/terrain/LayeredTerrainBuilder.js src/world/bricks/HeightfieldAO.js src/world/terrain/SurfaceClassifier.js src/world/terrain/VolcanoSurfaceFeatureGenerator.js
```

Expected: no matches. Visible render loops must use `terrainMap.width`/`terrainMap.depth` or generated sample dimensions. `TerrainGenerator` and `BiomeMaskGenerator` may still use config dimensions only as default options before chunk-specific options are supplied.

- [ ] **Step 3: Check achievement naming**

Run:

```bash
rg "biome_.*_core|achievementId: 'biome_|achievementId: \"biome_" src test
```

Expected: no `biome_*_core` route achievement ids and no route config field named plain `achievementId`. `discoveryAchievementId` is allowed.

- [ ] **Step 4: Run focused route and chunk tests**

Run:

```bash
npm test -- test/authoredBiomeRouteConfig.test.js test/chunkCoordinates.test.js test/chunkManager.test.js test/globalBiomeMask.test.js test/biomeRouteService.test.js test/progressState.test.js test/biomeStoryController.test.js test/gameHUD.test.js test/renderChunk.test.js
```

Expected: PASS.

- [ ] **Step 5: Run all tests**

Run:

```bash
npm test
```

Expected: PASS. If Windows reports `EPERM: operation not permitted, lstat 'C:\Users\f1686533'`, record it separately as environment noise and rerun the focused tests.

- [ ] **Step 6: Build**

Run:

```bash
npm run build
```

Expected: PASS. Existing Vite large-chunk warning is acceptable.

- [ ] **Step 7: Inspect working tree**

Run:

```bash
git status --short
git diff --stat
```

Expected: changed files are limited to route/chunk/progression/HUD implementation and tests. Do not stage unrelated local assets or unrelated worktree changes.

- [ ] **Step 8: Commit cleanup if needed**

If this task required cleanup edits:

```bash
git add -- src test docs/superpowers/plans/2026-06-25-authored-biome-route-implementation.md
git commit -m "chore: verify authored biome route"
```

If no files changed during cleanup, do not create an empty commit.
