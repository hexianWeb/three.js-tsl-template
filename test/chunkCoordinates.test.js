import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getActiveWindowKeys,
  getDominantMovementAxis,
  getRenderChunkCoord,
  getRenderChunkKey,
  getRenderChunkOrigin,
  parseRenderChunkKey,
  toLocalCell,
  toWorldBlock
} from '../src/world/chunks/chunkCoordinates.js'

test('maps world blocks to signed render chunk coordinates', () => {
  assert.deepEqual(getRenderChunkCoord(0, 0, 32), { x: 0, z: 0 })
  assert.deepEqual(getRenderChunkCoord(31, 31, 32), { x: 0, z: 0 })
  assert.deepEqual(getRenderChunkCoord(32, 32, 32), { x: 1, z: 1 })
  assert.deepEqual(getRenderChunkCoord(-1, -1, 32), { x: -1, z: -1 })
})

test('builds stable chunk keys and parses negative chunk keys', () => {
  assert.equal(getRenderChunkKey({ x: 4, z: 4 }), '4:4')
  assert.equal(getRenderChunkKey({ x: -2, z: 3 }), '-2:3')
  assert.deepEqual(parseRenderChunkKey('-2:3'), { x: -2, z: 3 })
})

test('builds origins for positive and negative chunk coordinates', () => {
  assert.deepEqual(getRenderChunkOrigin({ x: 4, z: 4 }, 32), { x: 128, z: 128 })
  assert.deepEqual(getRenderChunkOrigin({ x: -2, z: 3 }, 32), { x: -64, z: 96 })
})

test('loads corner chunks when near both boundaries', () => {
  assert.deepEqual(getActiveWindowKeys({ x: 0, z: 0 }, { x: 0, z: 0 }, 64, 0.75), [
    '0:0', '-1:0', '0:-1', '-1:-1'
  ])

  assert.deepEqual(getActiveWindowKeys({ x: 0, z: 0 }, { x: 63, z: 63 }, 64, 0.75), [
    '0:0', '1:0', '0:1', '1:1'
  ])
})

test('loads only the anchor chunk in the middle when stationary', () => {
  assert.deepEqual(getActiveWindowKeys({ x: 0, z: 0 }, { x: 40, z: 40 }, 64, 0.75), [
    '0:0'
  ])
})

test('loads one forward chunk when flying straight through the middle', () => {
  assert.deepEqual(
    getActiveWindowKeys({ x: 0, z: 0 }, { x: 40, z: 40 }, 64, 0.75, { x: 2, z: 0 }),
    ['0:0', '1:0']
  )
  assert.deepEqual(
    getActiveWindowKeys({ x: 0, z: 0 }, { x: 40, z: 40 }, 64, 0.75, { x: 0, z: -2 }),
    ['0:0', '0:-1']
  )
})

test('loads only one side chunk when near a single boundary', () => {
  assert.deepEqual(getActiveWindowKeys({ x: 0, z: 0 }, { x: 63, z: 40 }, 64, 0.75), [
    '0:0', '1:0'
  ])
})

test('ignores diagonal movement for middle-zone preload', () => {
  assert.deepEqual(
    getActiveWindowKeys({ x: 0, z: 0 }, { x: 40, z: 40 }, 64, 0.75, { x: 2, z: 2 }),
    ['0:0']
  )
})

test('detects dominant straight movement axis', () => {
  assert.deepEqual(getDominantMovementAxis({ x: 2, z: 0 }), { dx: 1, dz: 0 })
  assert.deepEqual(getDominantMovementAxis({ x: 0, z: -3 }), { dx: 0, dz: -1 })
  assert.equal(getDominantMovementAxis({ x: 2, z: 2 }), null)
  assert.equal(getDominantMovementAxis({ x: 0, z: 0 }), null)
})

test('converts between local chunk cells and world blocks', () => {
  assert.deepEqual(toWorldBlock({ x: 128, z: 128 }, 17, 17), { x: 145, z: 145 })
  assert.deepEqual(toLocalCell({ x: 128, z: 128 }, 145, 145), { x: 17, z: 17 })
})
