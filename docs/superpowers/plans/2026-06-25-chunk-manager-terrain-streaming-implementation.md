# Chunk Manager Terrain Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps may be checked off as work completes.

**Goal:** Make terrain chunks load and unload stably around the player aircraft before adding achievements or story progression.

**Architecture:** Keep chunk math pure and testable, then feed global block coordinates into existing biome and terrain generation. Each render chunk displays exactly `32x32` visible cells, but terrain generation samples a 1-cell halo (`34x34`) so neighbor-dependent systems can read `x +/- 1` and `z +/- 1` without chunk-edge artifacts. `World` owns a `ChunkManager` and a map of `RenderChunk` instances; route achievements and HUD are intentionally out of scope.

**Tech Stack:** Three.js WebGPU, existing `World.addSystem()` lifecycle, `node:test`, existing terrain/brick/prefab generation classes, Vite.

---

## Scope

This plan only answers: "Can terrain reliably follow the aircraft?"

In scope:
- render chunk config and global biome centers
- chunk coordinate helpers
- halo-aware biome/terrain generation
- global-coordinate height noise, lava pool, and prefab randomness
- debounced `ChunkManager`
- `RenderChunk` wrapper
- `World` chunk streaming integration
- debug panel, AO preview, camera, and shadow behavior after renderers become per-chunk
- seam, AO, water, cliff, and flicker verification

Out of scope:
- achievements
- ruin/story ordering
- `BiomeStoryController`
- `GameHUD`
- exploration motivation UI

---

### Task 1: Add Render Chunk And Global Biome Config

**Files:**
- Modify: `src/world/WorldConfig.js`
- Create: `test/renderChunkConfig.test.js`

**Step 1: Write the failing config test**

Create `test/renderChunkConfig.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { worldConfig } from '../src/world/WorldConfig.js'

test('defines first render chunk window config with halo sampling', () => {
  assert.deepEqual(worldConfig.terrain.renderChunk, {
    size: 32,
    halo: 1,
    activeRadius: 1,
    hysteresisCells: 4,
    dwellSeconds: 0.25
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
```

**Step 2: Run the failing test**

Run: `npm test -- test/renderChunkConfig.test.js`

Expected: FAIL because `terrain.renderChunk` does not exist and current biome regions are local test regions.

**Step 3: Update `WorldConfig.js`**

Add `renderChunk` inside `terrain` after `depth`:

```js
    renderChunk: {
      size: 32,
      halo: 1,
      activeRadius: 1,
      hysteresisCells: 4,
      dwellSeconds: 0.25
    },
```

Replace `biomes.regions` with global terrain regions only:

```js
    defaultBiome: 'forest',
    regions: [
      { id: 'forest', center: [0, 0], radius: 50, weight: 1 },
      { id: 'autumnForest', center: [145, 145], radius: 50, weight: 1 },
      { id: 'desert', center: [290, 80], radius: 50, weight: 1 },
      { id: 'volcano', center: [435, 190], radius: 50, weight: 1 }
    ]
```

Do not add achievement or story fields in this plan.

**Step 4: Verify the config test passes**

Run: `npm test -- test/renderChunkConfig.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add -- src/world/WorldConfig.js test/renderChunkConfig.test.js
git commit -m "feat: configure render chunks"
```

---

### Task 2: Add Render Chunk Coordinate Helpers

**Files:**
- Create: `src/world/chunks/chunkCoordinates.js`
- Create: `test/chunkCoordinates.test.js`

**Step 1: Write the failing coordinate tests**

Cover:
- world block to signed chunk coordinate
- stable chunk key and origin
- deterministic 3x3 active window
- local cell to world block conversion
- parsing negative chunk keys
- negative world block and origin conversion

Use these assertions:

```js
assert.deepEqual(getRenderChunkCoord(0, 0, 32), { x: 0, z: 0 })
assert.deepEqual(getRenderChunkCoord(31, 31, 32), { x: 0, z: 0 })
assert.deepEqual(getRenderChunkCoord(32, 32, 32), { x: 1, z: 1 })
assert.deepEqual(getRenderChunkCoord(-1, -1, 32), { x: -1, z: -1 })
assert.equal(getRenderChunkKey({ x: 4, z: 4 }), '4:4')
assert.equal(getRenderChunkKey({ x: -2, z: 3 }), '-2:3')
assert.deepEqual(parseRenderChunkKey('-2:3'), { x: -2, z: 3 })
assert.deepEqual(getRenderChunkOrigin({ x: 4, z: 4 }, 32), { x: 128, z: 128 })
assert.deepEqual(getRenderChunkOrigin({ x: -2, z: 3 }, 32), { x: -64, z: 96 })
assert.deepEqual(toWorldBlock({ x: 128, z: 128 }, 17, 17), { x: 145, z: 145 })
assert.deepEqual(toLocalCell({ x: 128, z: 128 }, 145, 145), { x: 17, z: 17 })
```

**Step 2: Run the failing test**

Run: `npm test -- test/chunkCoordinates.test.js`

Expected: FAIL because `chunkCoordinates.js` does not exist.

**Step 3: Implement coordinate helpers**

Create pure helpers:
- `getRenderChunkCoord(worldBlockX, worldBlockZ, chunkSize)`
- `getRenderChunkKey(coord)`
- `parseRenderChunkKey(key)`
- `getRenderChunkOrigin(coord, chunkSize)`
- `getActiveWindowKeys(anchorCoord, activeRadius)`
- `toWorldBlock(origin, localX, localZ)`
- `toLocalCell(origin, worldX, worldZ)`

**Step 4: Verify coordinate tests pass**

Run: `npm test -- test/chunkCoordinates.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add -- src/world/chunks/chunkCoordinates.js test/chunkCoordinates.test.js
git commit -m "feat: add render chunk coordinates"
```

---

### Task 3: Make Terrain Generation Halo-Aware

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

**Step 1: Write failing halo tests**

Create `test/globalBiomeMask.test.js` with tests for:
- biome mask samples global coordinates including halo (`originX: 127`, `originZ: 127`, `width: 34`, `depth: 34`)
- default biome fallback uses `config.biomes.defaultBiome`
- `TerrainMap` maps visible cells to sample cells
- `TerrainMap.hasCell(-1, 0)` is true for halo but `hasCell(-2, 0)` is false
- `TerrainMap.toWorldBlock(17, 17)` returns `{ x: 145, z: 145 }` for chunk origin `{ x: 128, z: 128 }`
- two adjacent chunks produce the same height/biome/surface values where one chunk's visible edge overlaps the other's halo
- terrain height noise uses world block coordinates, not repeated local `0..31` chunk coordinates
- lava pool noise uses world block coordinates, not repeated local `0..31` sample coordinates
- prefab placement random decisions use world block coordinates while prefab transforms stay visible-local

**Step 2: Run the failing test**

Run: `npm test -- test/globalBiomeMask.test.js`

Expected: FAIL because origin/halo generation and `TerrainMap` mapping do not exist.

**Step 3: Update biome and terrain generation**

`BiomeMaskGenerator.generate(options = {})` must accept `originX`, `originZ`, `width`, and `depth`.

`TerrainGenerator.generate(options = {})` must:
- keep `originX`/`originZ` as visible chunk origin
- compute `sampleOriginX = originX - halo`
- compute `sampleOriginZ = originZ - halo`
- generate `visibleWidth + halo * 2` by `visibleDepth + halo * 2`
- return a `TerrainMap` with `visible: { x: halo, z: halo, width: visibleWidth, depth: visibleDepth }`
- call biome and noise sampling with world sample coordinates: `worldX = sampleOriginX + sampleX`, `worldZ = sampleOriginZ + sampleZ`
- store visible chunk metadata on the returned map: `originX`, `originZ`, `halo`, `sampleOriginX`, and `sampleOriginZ`

`TerrainGenerator.generateHeightField(biomeCells, options)` must create a `HeightField(sampleWidth, sampleDepth)` but evaluate `fbm(worldX, worldZ)` for each sample cell. This prevents every render chunk from repeating the same local height pattern.

**Step 4: Update generated-field consumers**

`SurfaceClassifier` must derive `width` and `depth` from `heightField`, not from `config.terrain`.

`VolcanoSurfaceFeatureGenerator` must derive dimensions from `surfaceCells`, accept `options = { sampleOriginX: 0, sampleOriginZ: 0 }`, pass global sample coordinates into `isPoolCell()`, and update `assignPoolHeights()` to use `surfaceCells` dimensions. For a sample cell `(x, z)`, call `isPoolCell(sampleOriginX + x, sampleOriginZ + z, lavaConfig)`.

**Step 5: Update `TerrainMap`**

Add:
- `width`
- `depth`
- `sampleWidth`
- `sampleDepth`
- `toSampleCell(x, z)`
- `hasCell(x, z)`
- halo-aware `getHeight()`, `getBiomeCell()`, and `getSurfaceCell()`
- `toWorldBlock(x, z)` based on visible chunk origin

**Step 6: Update visible render loops**

`LayeredTerrainBuilder` and `HeightfieldAO` must use:

```js
const { width, depth } = terrainMap
```

Their neighbor height helpers must use `terrainMap.hasCell(x, z)` instead of treating visible chunk borders as out of bounds.

`WaterBrickRenderer`, `LavaBrickRenderer`, and `PrefabPlacer` must iterate `terrainMap.width`/`terrainMap.depth`, not `this.config.terrain.width`/`depth`.

Keep mesh transforms in visible-local coordinates (`0..31`). Use `terrainMap.toWorldBlock(x, z)` only for deterministic world-space decisions such as prefab random seeds, variant selection, rotation, and tree instance colors. For prefabs, compute:

```js
const worldBlock = terrainMap.toWorldBlock(x, z)
```

Use `worldBlock.x` and `worldBlock.z` for `placementRandom01()`, `pickVariantIndex()`, random rotation, `pickInstanceColorIndex()`, and `resolveTreeInstanceColor()`. Keep `makePrefabTransform()` positions local by passing local `x` and `z`; attach `worldX`/`worldZ` to the returned transform only if later color code needs global coordinates.

**Step 7: Verify tests**

Run:

```bash
npm test -- test/globalBiomeMask.test.js
npm test -- test/lavaRendering.test.js test/volcanoSurfaceFeatureGenerator.test.js
```

Expected: PASS.

**Step 8: Commit**

```bash
git add -- src/world/biomes/BiomeMaskGenerator.js src/world/terrain/TerrainGenerator.js src/world/terrain/TerrainMap.js src/world/terrain/SurfaceClassifier.js src/world/terrain/VolcanoSurfaceFeatureGenerator.js src/world/terrain/LayeredTerrainBuilder.js src/world/bricks/HeightfieldAO.js src/world/bricks/WaterBrickRenderer.js src/world/bricks/LavaBrickRenderer.js src/world/prefabs/PrefabPlacer.js test/globalBiomeMask.test.js
git commit -m "feat: sample render chunks with terrain halo"
```

---

### Task 4: Implement Debounced ChunkManager

**Files:**
- Create: `src/world/chunks/ChunkManager.js`
- Create: `test/chunkManager.test.js`

**Step 1: Write failing chunk manager tests**

Cover:
- first update creates a 3x3 active window
- shallow boundary jitter does not switch anchor
- moving past hysteresis switches anchor
- staying in candidate chunk for dwell time switches anchor
- unchanged anchor produces empty `loadKeys`/`unloadKeys`
- negative chunk boundaries use floor semantics and do not flicker around `-1/0`
- diagonal movement into a candidate chunk follows the same hysteresis/dwell rule
- jumping across more than one chunk anchors to the actual candidate chunk once hysteresis passes
- changing candidate chunks resets `candidateSeconds`

Use explicit cases like:

```js
const positiveBoundary = new ChunkManager(config)
positiveBoundary.update({ x: 31, z: 16 }, 0.016) // anchor 0:0
positiveBoundary.update({ x: 33, z: 16 }, 0.016) // still 0:0, only 1 cell into candidate
positiveBoundary.update({ x: 36, z: 16 }, 0.016) // switches to 1:0 with hysteresisCells 4

const negativeBoundary = new ChunkManager(config)
negativeBoundary.update({ x: 0, z: 0 }, 0.016) // anchor 0:0
negativeBoundary.update({ x: -1, z: 0 }, 0.016) // candidate -1:0 but no immediate flicker
negativeBoundary.update({ x: -4, z: 0 }, 0.016) // switches after 4 cells into negative candidate
```

**Step 2: Run the failing test**

Run: `npm test -- test/chunkManager.test.js`

Expected: FAIL because `ChunkManager.js` does not exist.

**Step 3: Implement `ChunkManager`**

Use `chunkCoordinates.js` helpers. Keep state:
- `anchorCoord`
- `activeKeys`
- `candidateKey`
- `candidateSeconds`

Anchor switching rules:
- initialize `anchorCoord` from the first update's candidate chunk
- when candidate equals anchor, clear `candidateKey` and reset `candidateSeconds`
- when candidate differs from anchor, compute how far the world block is inside the candidate chunk along each changed axis
- switch immediately when the player is at least `hysteresisCells` inside every changed candidate axis
- otherwise switch only after the same `candidateKey` remains stable for `dwellSeconds`
- if candidate changes before dwell completes, replace `candidateKey` and reset `candidateSeconds` to the current frame delta
- when a high-speed move jumps across multiple chunks, use the actual candidate chunk from the current world block; do not step through intermediate chunks

Return update results with:
- `changed`
- `anchorCoord`
- `anchorKey`
- `activeKeys`
- `loadKeys`
- `unloadKeys`

**Step 4: Verify tests pass**

Run: `npm test -- test/chunkManager.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add -- src/world/chunks/ChunkManager.js test/chunkManager.test.js
git commit -m "feat: add debounced chunk manager"
```

---

### Task 5: Add RenderChunk Wrapper

**Files:**
- Create: `src/world/chunks/RenderChunk.js`
- Create: `test/renderChunk.test.js`

**Step 1: Write failing RenderChunk tests**

Cover:
- root group is positioned at `origin * cellSize`
- `build()` forwards terrain map, placements, AO, and renderers
- `dispose()` forwards to owned renderers
- `setPreviewVisible(true)` hides water, lava, and prefab groups but leaves terrain visible
- exposed material references can be read by `World` for the debug MaterialPanel without relying on removed single-map renderer fields

**Step 2: Run the failing test**

Run: `npm test -- test/renderChunk.test.js`

Expected: FAIL because `RenderChunk.js` does not exist.

**Step 3: Implement `RenderChunk`**

`RenderChunk` owns one `THREE.Group` and one set of renderers:
- `terrain`
- `water`
- `lava`
- `prefabs`

`build({ terrainMap, placements, colorResolver, heightfieldAO })` adds renderer groups to the root group. `setPreviewVisible(preview)` hides water/lava/prefabs in AO preview. `updateInstanceColors()` delegates to terrain renderer.

Expose debug-friendly material accessors:

```js
get legoMaterial() {
  return this.renderers.terrain?.material ?? null
}

get waterMaterial() {
  return this.renderers.water?.material ?? null
}
```

**Step 4: Verify tests pass**

Run: `npm test -- test/renderChunk.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add -- src/world/chunks/RenderChunk.js test/renderChunk.test.js
git commit -m "feat: add render chunk wrapper"
```

---

### Task 6: Integrate Chunk Streaming Into World

**Files:**
- Modify: `src/world/world.js`

**Step 1: Add imports**

Add `ChunkManager`, `RenderChunk`, and chunk coordinate helpers to `src/world/world.js`.

Do not import or instantiate `BiomeStoryController` in this plan.

**Step 2: Replace single terrain renderer state**

Add:

```js
this.chunkManager = null
this.renderChunks = new Map()
```

Remove unreferenced single-map renderer ownership after chunk streaming is wired. `World` should no longer add terrain, water, lava, or prefab renderers to `children`; only `RenderChunk` owns and disposes those per-chunk renderers. Keep `playerAircraft` in `children`.

**Step 3: Initialize shared generation systems**

Create shared `BiomeRegistry`, `BiomeBlender`, `BiomeMaskGenerator`, `TerrainGenerator`, `LayeredTerrainBuilder`, `BrickColorResolver`, `PrefabRegistry`, and `ChunkManager` once in `build()`. Create new `HeightfieldAO`, terrain renderer, water renderer, lava renderer, and prefab placer per render chunk because they own meshes, groups, and instance buffers.

**Step 4: Add `createRenderChunk(key)`**

For each key:
- parse chunk coord
- compute origin
- generate terrain with `width: chunkConfig.size`, `depth: chunkConfig.size`, and `halo: chunkConfig.halo ?? 0`
- build placements and AO
- create per-chunk terrain/water/lava/prefab renderers
- create `RenderChunk`
- add it to `this.renderChunks` and `this.group`
- keep chunk-local mesh transforms; set only `RenderChunk.group.position` to the world offset
- return the created chunk so initial debug material references can be resolved

**Step 5: Add `updateRenderChunks()`**

Convert aircraft world units to world blocks using `terrain.cellSize`, call `chunkManager.update()`, dispose `unloadKeys`, and create missing `loadKeys`.

On the first build, call `updateRenderChunks()` once after `playerAircraft` exists so the initial `3x3` window is visible before the first animation frame. If the aircraft state is unavailable, use world block `{ x: 0, z: 0 }`.

After `anchorCoord` changes, update camera/shadow context that used to depend on the old `80x80` map center:

```js
const centerX = (anchorOrigin.x + chunkConfig.size * 0.5) * terrain.cellSize
const centerZ = (anchorOrigin.z + chunkConfig.size * 0.5) * terrain.cellSize
const halfExtent = (chunkConfig.size * (chunkConfig.activeRadius * 2 + 1)) * terrain.cellSize * 0.6
this.experience.environment.configureShadows({
  centerX,
  centerZ,
  halfExtent,
  maxHeight: terrain.maxHeight * terrain.layerHeight + 8
})
```

Do not force `worldCamera.lookAt()` every chunk update if the camera follow system is active; only preserve the initial camera framing behavior during build/regenerate.

**Step 6: Update `World.update()`**

Keep aircraft update first, then call `updateRenderChunks()`.

**Step 7: Update AO preview and dispose**

AO preview must iterate `this.renderChunks.values()` and call:
- `chunk.updateInstanceColors()`
- `chunk.setPreviewVisible(preview)`

`dispose()` must dispose and clear all render chunks before clearing world children.

Add a helper for the debug MaterialPanel:

```js
getDebugMaterials() {
  const firstChunk = this.renderChunks.values().next().value
  return {
    legoMaterial: firstChunk?.legoMaterial ?? null,
    waterMaterial: firstChunk?.waterMaterial ?? null
  }
}
```

Use that helper in `debuggerInit()` instead of `this.terrainBrickRenderer?.material` and `this.waterBrickRenderer?.material`.

**Step 8: Run focused tests**

Run:

```bash
npm test -- test/renderChunkConfig.test.js test/chunkCoordinates.test.js test/chunkManager.test.js test/globalBiomeMask.test.js test/renderChunk.test.js
```

Expected: PASS.

**Step 9: Run full tests and build**

Run:

```bash
npm test
npm run build
```

Expected: PASS. Existing Vite large-chunk warnings are acceptable.

**Step 10: Manual verification**

Run: `npm run dev`

Verify:
- aircraft appears and moves
- visible terrain follows the aircraft
- no visible flicker when moving back and forth around chunk boundaries
- no visible flicker around negative chunk boundaries if the aircraft is moved west/north of origin
- no false vertical side walls appear on chunk edges
- AO does not darken or break at chunk edges
- water and cliff edges continue across chunk boundaries
- terrain height, biome transitions, lava pools, and tree/prefab placement do not visibly repeat as identical `32x32` tiles
- shadows remain centered around the active terrain after flying toward autumn forest, desert, and volcano centers
- debug MaterialPanel opens without errors and still exposes terrain/water material controls
- AO preview toggles all active chunks consistently and restores water/lava/prefab visibility when disabled

**Step 11: Commit**

```bash
git add -- src/world/world.js
git commit -m "feat: stream render chunks around aircraft"
```

---

### Task 7: Final Chunk Verification

**Files:**
- Inspect files changed by Tasks 1-6.

**Step 1: Check forbidden old chunk assumptions**

Run:

```bash
rg "at most two|two chunk|nearest target-side|128 x 128.*chunk|64 x 64" src test
```

Expected: no runtime dependency on old chunk assumptions.

**Step 2: Check visible loops do not use global terrain dimensions**

Run:

```bash
rg "this\\.config\\.terrain\\.width|this\\.config\\.terrain\\.depth|config\\.terrain\\.width|config\\.terrain\\.depth|const \\{ width, depth.*config\\.terrain" src/world/bricks src/world/prefabs src/world/terrain/LayeredTerrainBuilder.js src/world/bricks/HeightfieldAO.js src/world/terrain/SurfaceClassifier.js src/world/terrain/VolcanoSurfaceFeatureGenerator.js
```

Expected: no matches. Visible loops must use `terrainMap.width`/`terrainMap.depth` or generated sample dimensions.

**Step 3: Check deterministic systems use world coordinates**

Run:

```bash
rg "placementRandom01\\(x, z|pickVariantIndex\\([^\\n]*x, z|pickInstanceColorIndex\\([^\\n]*x, z|resolveTreeInstanceColor\\([^\\n]*x|fbm\\(x, z\\)|isPoolCell\\(x, z" src/world
```

Expected: no matches in chunked generation paths. Height noise, lava pool noise, and prefab random decisions must use `worldX/worldZ` or `terrainMap.toWorldBlock(x, z)` values. Local `x,z` are still allowed for mesh transforms and visible-local placement positions.

**Step 4: Final focused verification**

Run:

```bash
npm test -- test/renderChunkConfig.test.js test/chunkCoordinates.test.js test/chunkManager.test.js test/globalBiomeMask.test.js test/renderChunk.test.js
npm run build
```

Expected: PASS.

**Step 5: Inspect working tree**

Run:

```bash
git status --short
git diff --stat
```

Expected: changed files are limited to chunk streaming, terrain generation, renderers, and tests.
