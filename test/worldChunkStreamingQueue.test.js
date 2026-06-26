import test from 'node:test'
import assert from 'node:assert/strict'
import World from '../src/world/world.js'

function makeWorldHarness(chunkResult) {
  const created = []
  const disposed = []
  const fakeWorld = {
    config: {
      terrain: {
        cellSize: 1,
        maxHeight: 10,
        layerHeight: 1,
        renderChunk: {
          size: 32,
          buildsPerFrame: 1
        }
      }
    },
    renderChunks: new Map([
      ['old:0', { dispose: () => disposed.push('old:0') }]
    ]),
    pendingLoadKeys: [],
    pendingLoadKeySet: new Set(),
    pendingUnloadKeys: [],
    pendingUnloadKeySet: new Set(),
    pendingBuildJobs: [],
    pendingBuildKeySet: new Set(),
    desiredActiveKeys: new Set(),
    playerAircraft: {
      state: {
        position: { x: 40, z: 0 }
      }
    },
    experience: {
      time: {
        getDelta() {
          return 0.016
        }
      },
      environment: {
        configureShadows() {}
      }
    },
    chunkManager: {
      update() {
        return chunkResult
      }
    },
    createRenderChunk(key) {
      created.push(key)
      const chunk = { dispose: () => disposed.push(key) }
      this.renderChunks.set(key, chunk)
      return chunk
    },
    createRenderChunkBuildJob(key) {
      created.push(`job:${key}`)
      return { key, phase: 'terrain', step: 0 }
    },
    stepRenderChunkBuildJob(job) {
      job.step += 1
      const phases = ['terrain', 'renderTerrain', 'renderWaterLava', 'prefabCollect', 'prefabBucket', 'attach']
      const index = phases.indexOf(job.phase)
      if (index < phases.length - 1) {
        job.phase = phases[index + 1]
        return job.phase === 'attach' ? false : false
      }
      const chunk = { dispose: () => disposed.push(job.key) }
      this.renderChunks.set(job.key, chunk)
      return true
    },
    configureChunkShadows() {}
  }

  Object.setPrototypeOf(fakeWorld, World.prototype)
  return { fakeWorld, created, disposed }
}

test('runtime chunk streaming starts one staged chunk job instead of synchronously building chunks', () => {
  const { fakeWorld, created, disposed } = makeWorldHarness({
    changed: true,
    anchorCoord: { x: 1, z: 0 },
    activeKeys: ['new:0', 'new:1', 'new:2'],
    loadKeys: ['new:0', 'new:1', 'new:2'],
    unloadKeys: ['old:0']
  })

  World.prototype.updateRenderChunks.call(fakeWorld)

  assert.deepEqual(created, ['job:new:0'])
  assert.deepEqual(fakeWorld.pendingLoadKeys, ['new:1', 'new:2'])
  assert.deepEqual(fakeWorld.pendingBuildJobs.map((job) => job.key), ['new:0'])
  assert.deepEqual(disposed, [])
})

test('queued streaming advances one staged chunk phase per frame', () => {
  const result = {
    changed: false,
    anchorCoord: { x: 1, z: 0 },
    activeKeys: ['new:0'],
    loadKeys: [],
    unloadKeys: []
  }
  const { fakeWorld, created } = makeWorldHarness(result)
  fakeWorld.pendingBuildJobs = [{ key: 'new:0', phase: 'terrain', step: 0 }]
  fakeWorld.pendingBuildKeySet = new Set(['new:0'])

  World.prototype.updateRenderChunks.call(fakeWorld)

  assert.deepEqual(created, [])
  assert.equal(fakeWorld.pendingBuildJobs[0].step, 1)
  assert.equal(fakeWorld.pendingBuildJobs[0].phase, 'renderTerrain')
  assert.equal(fakeWorld.renderChunks.has('new:0'), false)
})

test('queued streaming flushes deferred unloads only after queued loads and staged builds complete', () => {
  const result = {
    changed: false,
    anchorCoord: { x: 1, z: 0 },
    activeKeys: ['new:0', 'new:1', 'new:2'],
    loadKeys: [],
    unloadKeys: []
  }
  const { fakeWorld, created, disposed } = makeWorldHarness(result)
  fakeWorld.renderChunks.set('new:0', {})
  fakeWorld.pendingLoadKeys = ['new:1']
  fakeWorld.pendingLoadKeySet = new Set(['new:1'])
  fakeWorld.pendingBuildJobs = []
  fakeWorld.pendingBuildKeySet = new Set()
  fakeWorld.pendingUnloadKeys = ['old:0']
  fakeWorld.pendingUnloadKeySet = new Set(['old:0'])

  World.prototype.updateRenderChunks.call(fakeWorld)

  assert.deepEqual(created, ['job:new:1'])
  assert.deepEqual(fakeWorld.pendingLoadKeys, [])
  assert.deepEqual(disposed, [])

  for (let i = 0; i < 6; i++) {
    World.prototype.updateRenderChunks.call(fakeWorld)
  }

  assert.deepEqual(disposed, ['old:0'])
})
