import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three/webgpu'

import {
  calculateProbeGridLayout,
  normalizeProbeBounces,
  PROBE_GRID_CONFIG,
} from '../src/lighting/createLightProbeGridSystem.js'

test('probe grid auto-fits the unbaked bounds with reproducible defaults', () => {
  const bounds = new THREE.Box3(
    new THREE.Vector3(-2, 0, -3),
    new THREE.Vector3(4, 2, 5),
  )
  const layout = calculateProbeGridLayout(bounds)

  assert.deepEqual(layout.center.toArray(), [1, 1, 1])
  assert.deepEqual(layout.size.toArray(), [6.4, 2.4, 8.4])
  assert.deepEqual(layout.resolution.toArray(), [9, 5, 9])
  assert.equal(PROBE_GRID_CONFIG.bake.cubemapSize, 16)
  assert.equal(PROBE_GRID_CONFIG.bake.sampleCount, 256)
  assert.equal(PROBE_GRID_CONFIG.bake.bounces, 2)
})

test('probe bounce input is rounded and kept within the GUI range', () => {
  assert.equal(normalizeProbeBounces(0), 0)
  assert.equal(normalizeProbeBounces(1.6), 2)
  assert.equal(normalizeProbeBounces(9), 3)
  assert.equal(normalizeProbeBounces(-1), 0)
  assert.equal(normalizeProbeBounces('invalid'), PROBE_GRID_CONFIG.bake.bounces)
})

test('probe grid rejects missing or empty scene bounds', () => {
  assert.throws(() => calculateProbeGridLayout(null), /non-empty unbaked scene bounds/)
  assert.throws(
    () => calculateProbeGridLayout(new THREE.Box3()),
    /non-empty unbaked scene bounds/,
  )
})
