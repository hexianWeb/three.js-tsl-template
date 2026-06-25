import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getActiveWindowKeys,
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

test('builds a deterministic 3x3 active window around an anchor chunk', () => {
  assert.deepEqual(getActiveWindowKeys({ x: 4, z: 4 }, 1), [
    '3:3', '4:3', '5:3',
    '3:4', '4:4', '5:4',
    '3:5', '4:5', '5:5'
  ])
})

test('converts between local chunk cells and world blocks', () => {
  assert.deepEqual(toWorldBlock({ x: 128, z: 128 }, 17, 17), { x: 145, z: 145 })
  assert.deepEqual(toLocalCell({ x: 128, z: 128 }, 145, 145), { x: 17, z: 17 })
})
