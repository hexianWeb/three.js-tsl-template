import assert from 'node:assert/strict'
import test from 'node:test'
import { createAnimationClock } from '../src/app/createAnimationClock.js'
import { createExperimentParams } from '../src/app/params.js'
import { applySharedParams, getSharedParams, isCameraState, isCaseId, parseClockEpoch } from '../src/comparison/protocol.js'

test('parameter sync keeps independent cases intact and shares the animation clock state', () => {
  const left = { ...createExperimentParams(), caseId: 'E', exposure: 2, showProbeHelper: true, dayNightTime: 0.2 }
  const right = { ...createExperimentParams(), caseId: 'F', dayNightTime: 0.6 }
  applySharedParams(right, getSharedParams(left))
  assert.equal(right.exposure, 2)
  assert.equal(right.showProbeHelper, true)
  assert.equal(right.caseId, 'F')
  assert.equal(right.dayNightTime, 0.2)
  applySharedParams(right, { exposure: NaN, probeIntensity: 'oops', caseId: 'A', unknown: true })
  assert.equal(right.exposure, 2)
  assert.equal(right.probeIntensity, 1)
  assert.equal(right.caseId, 'F')
  assert.equal(Object.hasOwn(right, 'unknown'), false)
})

test('shared wall-clock epoch keeps both views on the same elapsed time', () => {
  const epoch = Date.now() - 4000
  const left = createAnimationClock(epoch)
  const right = createAnimationClock(epoch)
  assert.ok(Math.abs(left.elapsed() - right.elapsed()) < 0.02)
  assert.ok(left.elapsed() >= 3.9)
  assert.equal(parseClockEpoch('1234'), 1234)
  assert.equal(parseClockEpoch('nope'), null)
})

test('camera and case messages reject invalid projection states and inherited keys', () => {
  const pose = { position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], fov: 60, zoom: 1 }
  assert.equal(isCameraState(pose), true)
  for (const patch of [{ position: [0, 1] }, { target: [0, NaN, 0] }, { zoom: 0 }, { fov: 180 }]) {
    assert.equal(isCameraState({ ...pose, ...patch }), false)
  }
  assert.equal(isCaseId('F'), true)
  assert.equal(isCaseId('toString'), false)
  assert.equal(isCaseId('__proto__'), false)
})
