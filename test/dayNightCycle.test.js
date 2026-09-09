import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three/webgpu'

import {
  calculateDayNightState,
  createDayNightCycle,
} from '../src/dayNightCycle.js'

function assertColorClose(actual, expected) {
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) < 1e-9)
  })
}

test('day/night module exposes its state calculator and scene controller', () => {
  assert.equal(typeof calculateDayNightState, 'function')
  assert.equal(typeof createDayNightCycle, 'function')
})

test('noon uses the full warm direct light above the scene', () => {
  const state = calculateDayNightState(0.5, 4)

  assert.ok(Math.abs(state.position.x) < 1e-9)
  assert.equal(state.position.y, 10)
  assert.equal(state.intensity, 4)
  assertColorClose(state.lightColor, [1, 0.95, 0.82])
})

test('midnight keeps only a small cool moon light', () => {
  const state = calculateDayNightState(0, 4)

  assert.ok(Math.abs(state.position.x) < 1e-9)
  assert.equal(state.position.y, 10)
  assert.equal(state.intensity, 0.32)
  assert.deepEqual(state.lightColor, [0.32, 0.42, 0.68])
})

test('controller applies the selected time and advances only while automatic playback is enabled', () => {
  const scene = new THREE.Scene()
  const light = new THREE.DirectionalLight()
  const params = {
    caseName: 'B',
    dayNightAuto: false,
    dayNightTime: 0.5,
    directIntensity: 4,
  }
  const cycle = createDayNightCycle({ scene, light, params })

  cycle.update(15)
  assert.equal(params.dayNightTime, 0.5)
  assert.equal(light.intensity, 4)
  assert.equal(scene.background.getHexString(), '000000')

  params.dayNightAuto = true
  cycle.update(15)
  assert.equal(params.dayNightTime, 0)
  assert.equal(light.intensity, 0.32)
})
