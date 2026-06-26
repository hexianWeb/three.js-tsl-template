import test from 'node:test'
import assert from 'node:assert/strict'
import ChunkManager from '../src/world/chunks/ChunkManager.js'

const config = {
  size: 64,
  quadrantThreshold: 0.75,
  hysteresisCells: 4,
  dwellSeconds: 0.25
}

test('first update loads corner chunks near both boundaries', () => {
  const manager = new ChunkManager(config)
  const result = manager.update({ x: 10, z: 10 }, 0.016)

  assert.equal(result.changed, true)
  assert.deepEqual(result.anchorCoord, { x: 0, z: 0 })
  assert.equal(result.anchorKey, '0:0')
  assert.deepEqual(result.activeKeys, [
    '0:0', '-1:0', '0:-1', '-1:-1'
  ])
  assert.deepEqual(result.loadKeys, result.activeKeys)
  assert.deepEqual(result.unloadKeys, [])
})

test('middle of chunk with no movement keeps only the anchor chunk', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 10, z: 10 }, 0.016)
  const result = manager.update({ x: 40, z: 40 }, 0.016)

  assert.equal(result.changed, true)
  assert.deepEqual(result.activeKeys, ['0:0'])
  assert.deepEqual(result.loadKeys, [])
  assert.deepEqual([...result.unloadKeys].sort(), ['-1:-1', '-1:0', '0:-1'].sort())
})

test('middle of chunk loads one forward chunk when flying straight', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 10, z: 10 }, 0.016)
  const result = manager.update({ x: 40, z: 40 }, 0.016, { x: 2, z: 0 })

  assert.equal(result.changed, true)
  assert.deepEqual(result.activeKeys, ['0:0', '1:0'])
  assert.deepEqual(result.loadKeys, ['1:0'])
  assert.deepEqual([...result.unloadKeys].sort(), ['-1:-1', '-1:0', '0:-1'].sort())
})

test('unchanged anchor and active set produces empty load and unload keys', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 40, z: 40 }, 0.016, { x: 2, z: 0 })
  const result = manager.update({ x: 41, z: 40 }, 0.016, { x: 2, z: 0 })

  assert.equal(result.changed, false)
  assert.deepEqual(result.loadKeys, [])
  assert.deepEqual(result.unloadKeys, [])
})

test('moving near a boundary updates active keys toward that edge', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 10, z: 10 }, 0.016)
  const result = manager.update({ x: 48, z: 10 }, 0.016)

  assert.equal(result.changed, true)
  assert.deepEqual(result.anchorCoord, { x: 0, z: 0 })
  assert.deepEqual(result.loadKeys, ['1:0', '1:-1'])
  assert.deepEqual([...result.unloadKeys].sort(), ['-1:-1', '-1:0'].sort())
})

test('shallow positive boundary jitter does not switch anchor', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 63, z: 32 }, 0.016)
  const result = manager.update({ x: 65, z: 32 }, 0.016)

  assert.equal(result.changed, false)
  assert.deepEqual(result.anchorCoord, { x: 0, z: 0 })
})

test('moving past hysteresis switches anchor', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 63, z: 32 }, 0.016)
  const result = manager.update({ x: 112, z: 32 }, 0.016)

  assert.equal(result.changed, true)
  assert.deepEqual(result.anchorCoord, { x: 1, z: 0 })
  assert.equal(result.anchorKey, '1:0')
  assert.ok(result.loadKeys.includes('2:0'))
  assert.ok(result.unloadKeys.includes('0:0'))
})

test('staying in candidate chunk for dwell time switches anchor', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 63, z: 32 }, 0.016)
  manager.update({ x: 65, z: 32 }, 0.1)
  const result = manager.update({ x: 65, z: 32 }, 0.15)

  assert.equal(result.changed, true)
  assert.deepEqual(result.anchorCoord, { x: 1, z: 0 })
})

test('negative chunk boundary uses floor semantics and hysteresis', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 0, z: 0 }, 0.016)
  const shallow = manager.update({ x: -1, z: 0 }, 0.016)
  const switched = manager.update({ x: -4, z: 0 }, 0.016)

  assert.equal(shallow.changed, false)
  assert.deepEqual(shallow.anchorCoord, { x: 0, z: 0 })
  assert.equal(switched.changed, true)
  assert.deepEqual(switched.anchorCoord, { x: -1, z: 0 })
})

test('diagonal movement switches only after every changed axis passes hysteresis', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 63, z: 63 }, 0.016)
  const shallow = manager.update({ x: 68, z: 65 }, 0.016)
  const switched = manager.update({ x: 68, z: 68 }, 0.016)

  assert.equal(shallow.changed, false)
  assert.deepEqual(shallow.anchorCoord, { x: 0, z: 0 })
  assert.equal(switched.changed, true)
  assert.deepEqual(switched.anchorCoord, { x: 1, z: 1 })
})

test('high-speed movement anchors to the actual candidate chunk', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 0, z: 0 }, 0.016)
  const result = manager.update({ x: 200, z: 0 }, 0.016)

  assert.equal(result.changed, true)
  assert.deepEqual(result.anchorCoord, { x: 3, z: 0 })
})

test('changing candidate chunks resets dwell timer', () => {
  const manager = new ChunkManager(config)
  manager.update({ x: 63, z: 32 }, 0.016)
  manager.update({ x: 65, z: 32 }, 0.2)
  manager.update({ x: 32, z: 65 }, 0.1)
  const result = manager.update({ x: 32, z: 65 }, 0.14)

  assert.equal(result.changed, false)
  assert.deepEqual(result.anchorCoord, { x: 0, z: 0 })
})
