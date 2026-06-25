# Biome Achievement System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the player's reason to explore the streamed terrain: unordered biome discovery achievements, story-ordered ruin progression, and a small HUD that reports route progress.

**Architecture:** This plan depends on `docs/superpowers/plans/2026-06-25-chunk-manager-terrain-streaming-implementation.md` being complete and manually verified. It does not change terrain streaming behavior. It enriches the existing global biome regions with achievement/story metadata, then adds pure progress and route services before wiring a runtime controller and HUD into the app.

**Tech Stack:** Three.js WebGPU, existing `World.addSystem()` lifecycle, `node:test`, `mitt` event bus, DOM HUD, Vite.

---

## Prerequisites

Complete and verify the chunk plan first:

`docs/superpowers/plans/2026-06-25-chunk-manager-terrain-streaming-implementation.md`

Required state before starting:
- aircraft-following terrain streaming is stable
- render chunks display `32x32` visible cells with 1-cell halo sampling
- chunk seams do not show false side walls, AO breaks, water discontinuity, or cliff gaps
- `WorldConfig.biomes.regions` already uses global centers

This plan answers: "Why should the player explore those streamed terrains?"

---

### Task 1: Add Achievement And Story Metadata To Biome Config

**Files:**
- Modify: `src/world/WorldConfig.js`
- Create: `test/authoredBiomeAchievementConfig.test.js`

**Step 1: Write the failing config test**

Create `test/authoredBiomeAchievementConfig.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { worldConfig } from '../src/world/WorldConfig.js'

test('defines authored biome achievement metadata in story order', () => {
  const { regions } = worldConfig.biomes

  assert.deepEqual(regions.map((region) => region.id), [
    'forest',
    'autumnForest',
    'desert',
    'volcano'
  ])
  assert.deepEqual(regions.map((region) => region.storyOrder), [0, 1, 2, 3])
  assert.deepEqual(regions.map((region) => region.achievementRadius), [40, 40, 40, 40])
  assert.deepEqual(regions.map((region) => region.discoveryAchievementId), [
    'biome_forest_discovered',
    'biome_autumn_forest_discovered',
    'biome_desert_discovered',
    'biome_volcano_discovered'
  ])
  assert.equal(regions.every((region) => region.ruinId && region.storyId && region.displayName), true)
})

test('defines default route interaction radii', () => {
  assert.equal(worldConfig.biomes.achievementRadius, 40)
  assert.equal(worldConfig.biomes.ruinActivationRadius, 5)
})
```

**Step 2: Run the failing test**

Run: `npm test -- test/authoredBiomeAchievementConfig.test.js`

Expected: FAIL because chunk config has global biome centers but no achievement/story metadata yet.

**Step 3: Enrich `WorldConfig.js`**

Add to `biomes`:

```js
    achievementRadius: 40,
    ruinActivationRadius: 5,
```

For each existing global region, add:
- `displayName`
- `achievementRadius`
- `storyOrder`
- `discoveryAchievementId`
- `ruinId`
- `storyId`

Do not change the chunk centers, radii, or render chunk config from the chunk plan.

**Step 4: Verify the config test passes**

Run: `npm test -- test/authoredBiomeAchievementConfig.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add -- src/world/WorldConfig.js test/authoredBiomeAchievementConfig.test.js
git commit -m "feat: configure biome achievements"
```

---

### Task 2: Add ProgressState

**Files:**
- Create: `src/world/progression/ProgressState.js`
- Create: `test/progressState.test.js`

**Step 1: Write the failing progress tests**

Cover:
- confirmed and discovered biomes are recorded once
- achievements unlock once
- only current-order ruins can activate
- `currentStoryIndex` advances after story viewing
- all-biomes-complete checks discovered biome ids

Use representative assertions:

```js
const state = new ProgressState()
assert.equal(state.confirmBiome('volcano'), true)
assert.equal(state.confirmBiome('volcano'), false)
assert.equal(state.unlockAchievement('biome_volcano_discovered'), true)
assert.equal(state.unlockAchievement('biome_volcano_discovered'), false)
assert.equal(state.canActivateStoryOrder(0), true)
```

**Step 2: Run the failing test**

Run: `npm test -- test/progressState.test.js`

Expected: FAIL because `ProgressState.js` does not exist.

**Step 3: Implement `ProgressState`**

Create `src/world/progression/ProgressState.js` with:
- `confirmedBiomeIds`
- `discoveredBiomeIds`
- `unlockedAchievementIds`
- `activatedRuinIds`
- `viewedStoryIds`
- `currentStoryIndex`
- `confirmBiome(id)`
- `discoverBiome(id)`
- `unlockAchievement(id)`
- `activateRuin(id)`
- `viewStory(id)`
- `canActivateStoryOrder(storyOrder)`
- `advanceStory()`
- `areAllBiomesDiscovered(biomeIds)`

Keep this class in-memory only. Do not add persistence in this plan.

**Step 4: Verify progress tests pass**

Run: `npm test -- test/progressState.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add -- src/world/progression/ProgressState.js test/progressState.test.js
git commit -m "feat: add biome progress state"
```

---

### Task 3: Add BiomeRouteService

**Files:**
- Create: `src/world/biomes/BiomeRouteService.js`
- Create: `test/biomeRouteService.test.js`

**Step 1: Write the failing route service tests**

Cover:
- route regions sort by `storyOrder`
- confirmed biome resolves only inside `achievementRadius`
- later biomes can be discovered out of order
- out-of-order ruins emit blocked events
- current-order ruins activate and advance story
- next story target resolves from `currentStoryIndex`

Important expected event sequence for discovering a later biome early:

```js
assert.deepEqual(events.map((event) => event.type), [
  'biome:changed',
  'biome:confirmed',
  'biome:discovered',
  'achievement:unlocked',
  'ruin:blocked'
])
```

**Step 2: Run the failing test**

Run: `npm test -- test/biomeRouteService.test.js`

Expected: FAIL because `BiomeRouteService.js` does not exist.

**Step 3: Implement `BiomeRouteService`**

Create `src/world/biomes/BiomeRouteService.js`.

Responsibilities:
- normalize region defaults from config
- sort regions by `storyOrder`
- resolve current visual biome by region `radius`
- resolve confirmed biome by `achievementRadius`
- resolve ruin by `ruinActivationRadius`
- update `ProgressState`
- emit route event objects
- expose `getNextStoryTarget(progress)`

Do not mutate terrain or chunk state from this service.

**Step 4: Verify route service tests pass**

Run: `npm test -- test/biomeRouteService.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add -- src/world/biomes/BiomeRouteService.js test/biomeRouteService.test.js
git commit -m "feat: add authored biome route service"
```

---

### Task 4: Add Runtime BiomeStoryController

**Files:**
- Create: `src/world/story/BiomeStoryController.js`
- Modify: `src/world/world.js`
- Create: `test/biomeStoryController.test.js`

**Step 1: Write the failing controller tests**

Cover:
- controller converts aircraft world units to world blocks using `terrain.cellSize`
- controller emits route service events through the event bus
- controller skips update when player aircraft is missing
- controller creates placeholder ruin markers at global biome centers
- controller disposes marker geometry/material/group

**Step 2: Run the failing test**

Run: `npm test -- test/biomeStoryController.test.js`

Expected: FAIL because `BiomeStoryController.js` does not exist.

**Step 3: Implement `BiomeStoryController`**

Create `src/world/story/BiomeStoryController.js`.

Use:
- `BiomeRouteService`
- `ProgressState`
- `eventBus` from `src/utils/event-bus.js`
- `THREE.Group` for placeholder ruin markers

`update()` should:
- read `experience.world.playerAircraft.state.position`
- divide `x` and `z` by `config.terrain.cellSize`
- call `routeService.update(worldBlock, progress)`
- emit each event with `nextTarget`

**Step 4: Verify controller tests pass**

Run: `npm test -- test/biomeStoryController.test.js`

Expected: PASS.

**Step 5: Wire controller into `World`**

Only wire this after the chunk plan's manual boundary verification is done.

In `src/world/world.js`, import `BiomeStoryController`, keep `this.biomeStoryController = null`, create it in `build()` after chunk streaming systems are initialized, and add it through `this.addSystem(this.biomeStoryController)`.

If story events later need newest chunk state, do not add it to `children`; call it manually after `updateRenderChunks()` instead.

**Step 6: Commit**

```bash
git add -- src/world/story/BiomeStoryController.js src/world/world.js test/biomeStoryController.test.js
git commit -m "feat: add biome story controller"
```

---

### Task 5: Add GameHUD

**Files:**
- Create: `src/ui/GameHUD.js`
- Create: `test/gameHUD.test.js`
- Modify: `src/style.css`
- Modify: `src/app/Experience.js`

**Step 1: Write the failing HUD test**

Cover:
- HUD updates text from `biome:confirmed`
- HUD updates text from `achievement:unlocked`
- HUD displays blocked ruin feedback
- HUD clears next target on `biomes:complete`
- `dispose()` unsubscribes handlers and removes the DOM root

**Step 2: Run the failing test**

Run: `npm test -- test/gameHUD.test.js`

Expected: FAIL because `GameHUD.js` does not exist.

**Step 3: Create DOM HUD class**

Create `src/ui/GameHUD.js`.

It should subscribe to:
- `biome:confirmed`
- `achievement:unlocked`
- `ruin:blocked`
- `ruin:activated`
- `biomes:complete`

Keep the HUD simple: one message line and one next-target line. Do not add inventory, quest logs, or persistence in this plan.

**Step 4: Add HUD styles**

Append compact fixed-position styles for:
- `.game-hud`
- `.game-hud__message`
- `.game-hud__next`

**Step 5: Wire HUD into `Experience`**

In `src/app/Experience.js`:
- import `GameHUD`
- import shared `eventBus`
- assign `this.eventBus = eventBus`
- create `this.gameHUD = new GameHUD({ eventBus: this.eventBus })` after `this.world.build()`
- dispose `this.gameHUD` before disposing the world

**Step 6: Run tests and build**

Run:

```bash
npm test -- test/gameHUD.test.js
npm test
npm run build
```

Expected: PASS. Existing Vite large-chunk warnings are acceptable.

**Step 7: Commit**

```bash
git add -- src/ui/GameHUD.js src/style.css src/app/Experience.js test/gameHUD.test.js
git commit -m "feat: add biome route HUD"
```

---

### Task 6: Final Achievement Verification

**Files:**
- Inspect files changed by Tasks 1-5.

**Step 1: Check achievement naming**

Run:

```bash
rg "biome_.*_core|achievementId: 'biome_|achievementId: \"biome_" src test
```

Expected: no `biome_*_core` route achievement ids and no route config field named plain `achievementId`. `discoveryAchievementId` is allowed.

**Step 2: Run focused achievement tests**

Run:

```bash
npm test -- test/authoredBiomeAchievementConfig.test.js test/biomeRouteService.test.js test/progressState.test.js test/biomeStoryController.test.js test/gameHUD.test.js
```

Expected: PASS.

**Step 3: Run all tests**

Run: `npm test`

Expected: PASS. If Windows reports `EPERM: operation not permitted, lstat 'C:\Users\f1686533'`, record it separately as environment noise and rerun focused tests.

**Step 4: Build**

Run: `npm run build`

Expected: PASS. Existing Vite large-chunk warning is acceptable.

**Step 5: Manual verification**

Run: `npm run dev`

Verify:
- terrain still follows the aircraft exactly as it did after the chunk plan
- entering a biome unlocks that biome's discovery once
- entering a later biome early unlocks discovery but blocks ruin story
- entering the current story-order ruin activates story and advances to next target
- HUD shows confirmed biome, discovery, blocked ruin, activated ruin, and completion messages

**Step 6: Inspect working tree**

Run:

```bash
git status --short
git diff --stat
```

Expected: changed files are limited to achievement/story/HUD implementation and tests.
