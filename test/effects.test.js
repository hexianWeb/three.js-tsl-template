import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three/webgpu'
import { createEmissiveSystem } from '../src/effects/emissive/createEmissiveSystem.js'
import { createFireflies, FIREFLY_LAYER } from '../src/effects/fireflies.js'

test('portal has full-face effect coordinates without changing baked UVs', () => {
  const geometry = new THREE.CircleGeometry(0.72, 32)
  geometry.rotateX(Math.PI / 2)
  const atlas = geometry.attributes.uv.array.slice()
  const mesh = new THREE.Mesh(geometry)
  mesh.name = 'Circle'
  createEmissiveSystem({ portalColor: '#438dff', portalIntensity: 1.6, portalSpeed: 0.28,
    poleColor: '#ff4e18', poleIntensity: 1 }).tryAttach(mesh, 'baked')
  const effect = geometry.getAttribute('portalUv')
  assert.ok(effect)
  assert.deepEqual(geometry.attributes.uv.array, atlas)
  for (const axis of [0, 1]) {
    const values = Array.from({ length: effect.count }, (_, i) => effect.array[i * 2 + axis])
    assert.ok(Math.min(...values) < 0.01 && Math.max(...values) > 0.99)
  }
})

test('fireflies stay off the default layer so SSGI G-buffer ignores the quads', () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  const fireflies = createFireflies({ scene, camera })
  const sceneLayers = new THREE.Layers()
  sceneLayers.set(0)
  assert.equal(fireflies.layers.isEnabled(FIREFLY_LAYER), true)
  assert.equal(fireflies.layers.test(sceneLayers), false)
  assert.equal(fireflies.layers.test(camera.layers), true)
})
