# Chunk Manager Terrain Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

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
- debounced `ChunkManager`
- `RenderChunk` wrapper
- `World` chunk streaming integration
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

Use these assertions:

```js
assert.deepEqual(getRenderChunkCoord(0, 0, 32), { x: 0, z: 0 })
assert.deepEqual(getRenderChunkCoord(31, 31, 32), { x: 0, z: 0 })
assert.deepEqual(getRenderChunkCoord(32, 32, 32), { x: 1, z: 1 })
assert.deepEqual(getRenderChunkCoord(-1, -1, 32), { x: -1, z: -1 })
assert.equal(getRenderChunkKey({ x: 4, z: 4 }), '4:4')
assert.deepEqual(getRenderChunkOrigin({ x: 4, z: 4 }, 32), { x: 128, z: 128 })
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

**Step 4: Update generated-field consumers**

`SurfaceClassifier` must derive `width` and `depth` from `heightField`, not from `config.terrain`.

`VolcanoSurfaceFeatureGenerator` must derive dimensions from `surfaceCells`, pass global sample coordinates into `isPoolCell()`, and update `assignPoolHeights()` to use `surfaceCells` dimensions.

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

Keep mesh transforms in visible-local coordinates (`0..31`). Use `terrainMap.toWorldBlock(x, z)` only for deterministic world-space decisions such as prefab random seeds.

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

**Step 2: Run the failing test**

Run: `npm test -- test/chunkManager.test.js`

Expected: FAIL because `ChunkManager.js` does not exist.

**Step 3: Implement `ChunkManager`**

Use `chunkCoordinates.js` helpers. Keep state:
- `anchorCoord`
- `activeKeys`
- `candidateKey`
- `candidateSeconds`

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

Keep old renderer properties until the chunk implementation is verified, then remove unreferenced single-map renderer state.

**Step 3: Initialize shared generation systems**

Create shared `BiomeRegistry`, `BiomeBlender`, `BiomeMaskGenerator`, `TerrainGenerator`, `LayeredTerrainBuilder`, `BrickColorResolver`, and `ChunkManager` once in `build()`.

**Step 4: Add `createRenderChunk(key)`**

For each key:
- parse chunk coord
- compute origin
- generate terrain with `width: chunkConfig.size`, `depth: chunkConfig.size`, and `halo: chunkConfig.halo ?? 0`
- build placements and AO
- create per-chunk terrain/water/lava/prefab renderers
- create `RenderChunk`
- add it to `this.renderChunks` and `this.group`

**Step 5: Add `updateRenderChunks()`**

Convert aircraft world units to world blocks using `terrain.cellSize`, call `chunkManager.update()`, dispose `unloadKeys`, and create missing `loadKeys`.

**Step 6: Update `World.update()`**

Keep aircraft update first, then call `updateRenderChunks()`.

**Step 7: Update AO preview and dispose**

AO preview must iterate `this.renderChunks.values()` and call:
- `chunk.updateInstanceColors()`
- `chunk.setPreviewVisible(preview)`

`dispose()` must dispose and clear all render chunks before clearing world children.

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
- no false vertical side walls appear on chunk edges
- AO does not darken or break at chunk edges
- water and cliff edges continue across chunk boundaries

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

**Step 3: Final focused verification**

Run:

```bash
npm test -- test/renderChunkConfig.test.js test/chunkCoordinates.test.js test/chunkManager.test.js test/globalBiomeMask.test.js test/renderChunk.test.js
npm run build
```

Expected: PASS.

**Step 4: Inspect working tree**

Run:

```bash
git status --short
git diff --stat
```

Expected: changed files are limited to chunk streaming, terrain generation, renderers, and tests.
