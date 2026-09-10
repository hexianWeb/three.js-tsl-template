import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three/webgpu'
import { createEmissive } from '../src/emissive.js'

test('portal has full-face effect coordinates without changing baked UVs', () => {
  const geometry = new THREE.CircleGeometry(0.72, 32)
  geometry.rotateX(Math.PI / 2)
  const atlas = geometry.attributes.uv.array.slice()
  const mesh = new THREE.Mesh(geometry)
  mesh.name = 'Circle'
  createEmissive({ portalColor: '#438dff', portalIntensity: 1.6, portalSpeed: 0.28,
    poleColor: '#ff4e18', poleIntensity: 1 }).tryAttach(mesh)
  const effect = geometry.getAttribute('portalUv')
  assert.ok(effect)
  assert.deepEqual(geometry.attributes.uv.array, atlas)
  for (const axis of [0, 1]) {
    const values = Array.from({ length: effect.count }, (_, i) => effect.array[i * 2 + axis])
    assert.ok(Math.min(...values) < 0.01 && Math.max(...values) > 0.99)
  }
})
