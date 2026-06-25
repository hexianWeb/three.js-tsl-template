import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import RenderChunk from '../src/world/chunks/RenderChunk.js'

function makeRenderer(name, material = null) {
  return {
    group: new THREE.Group(),
    material,
    buildCalls: [],
    disposed: false,
    updateCalls: 0,
    build(...args) {
      this.buildCalls.push(args)
      this.group.name = name
      return this.group
    },
    updateInstanceColors() {
      this.updateCalls += 1
    },
    dispose() {
      this.disposed = true
      this.group.parent?.remove(this.group)
    }
  }
}

test('positions chunk root at render chunk world offset', () => {
  const chunk = new RenderChunk({
    key: '4:4',
    origin: { x: 128, z: 128 },
    cellSize: 0.2,
    renderers: {}
  })

  assert.equal(chunk.group.position.x, 25.6)
  assert.equal(chunk.group.position.z, 25.6)
})

test('build forwards terrain map, placements, color resolver, and AO to renderers', () => {
  const terrain = makeRenderer('terrain')
  const water = makeRenderer('water')
  const lava = makeRenderer('lava')
  const prefabs = makeRenderer('prefabs')
  const chunk = new RenderChunk({
    key: '0:0',
    origin: { x: 0, z: 0 },
    cellSize: 0.2,
    renderers: { terrain, water, lava, prefabs }
  })
  const terrainMap = {}
  const placements = []
  const colorResolver = {}
  const heightfieldAO = {}

  chunk.build({ terrainMap, placements, colorResolver, heightfieldAO })

  assert.deepEqual(terrain.buildCalls[0], [placements, colorResolver, heightfieldAO])
  assert.deepEqual(water.buildCalls[0], [terrainMap])
  assert.deepEqual(lava.buildCalls[0], [terrainMap])
  assert.deepEqual(prefabs.buildCalls[0], [terrainMap])
  assert.equal(chunk.group.children.length, 4)
})

test('updates terrain colors and toggles preview visibility for nonterrain groups', () => {
  const terrain = makeRenderer('terrain')
  const water = makeRenderer('water')
  const lava = makeRenderer('lava')
  const prefabs = makeRenderer('prefabs')
  const chunk = new RenderChunk({
    key: '0:0',
    origin: { x: 0, z: 0 },
    cellSize: 0.2,
    renderers: { terrain, water, lava, prefabs }
  })
  chunk.build({ terrainMap: {}, placements: [], colorResolver: {}, heightfieldAO: {} })

  chunk.updateInstanceColors()
  chunk.setPreviewVisible(true)

  assert.equal(terrain.updateCalls, 1)
  assert.equal(terrain.group.visible, true)
  assert.equal(water.group.visible, false)
  assert.equal(lava.group.visible, false)
  assert.equal(prefabs.group.visible, false)

  chunk.setPreviewVisible(false)

  assert.equal(water.group.visible, true)
  assert.equal(lava.group.visible, true)
  assert.equal(prefabs.group.visible, true)
})

test('exposes debug material references from owned renderers', () => {
  const legoMaterial = { name: 'lego' }
  const waterMaterial = { name: 'water' }
  const chunk = new RenderChunk({
    key: '0:0',
    origin: { x: 0, z: 0 },
    cellSize: 0.2,
    renderers: {
      terrain: makeRenderer('terrain', legoMaterial),
      water: makeRenderer('water', waterMaterial)
    }
  })

  assert.equal(chunk.legoMaterial, legoMaterial)
  assert.equal(chunk.waterMaterial, waterMaterial)
})

test('dispose forwards to owned renderers and removes group children', () => {
  const terrain = makeRenderer('terrain')
  const water = makeRenderer('water')
  const lava = makeRenderer('lava')
  const prefabs = makeRenderer('prefabs')
  const chunk = new RenderChunk({
    key: '0:0',
    origin: { x: 0, z: 0 },
    cellSize: 0.2,
    renderers: { terrain, water, lava, prefabs }
  })
  chunk.build({ terrainMap: {}, placements: [], colorResolver: {}, heightfieldAO: {} })

  chunk.dispose()

  assert.equal(terrain.disposed, true)
  assert.equal(water.disposed, true)
  assert.equal(lava.disposed, true)
  assert.equal(prefabs.disposed, true)
  assert.equal(chunk.group.children.length, 0)
})
