import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three/webgpu'

import {
  calculateCandleFlicker,
  calculateFlameDistortion,
} from '../src/effects/emissive/createCandleFlame.js'
import { createEmissiveSystem } from '../src/effects/emissive/createEmissiveSystem.js'

const params = {
  portalColor: '#ffffff',
  portalIntensity: 1,
  portalSpeed: 0.28,
  poleColor: '#ff4e18',
  poleIntensity: 1,
  poleFlameHeight: 1,
  poleFlameWidth: 1,
  poleFlameCore: 0.55,
}

test('emissive meshes start in emission view and can switch to UV debug', () => {
  const emissive = createEmissiveSystem(params)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())
  mesh.name = 'Circle'

  assert.equal(emissive.tryAttach(mesh, 'baked'), true)
  assert.equal(mesh.material.name, 'portal-emission')

  emissive.setUvDebug(true)
  assert.equal(mesh.material.name, 'emission-uv-debug')

  emissive.setUvDebug(false)
  assert.equal(mesh.material.name, 'portal-emission')
})

test('GLTF-normalized lantern names are included in the UV debug view', () => {
  const emissive = createEmissiveSystem(params)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  mesh.name = 'Cube011'

  assert.equal(emissive.tryAttach(mesh, 'baked'), true)
  assert.equal(mesh.material.name, 'pole-emission')
  assert.equal(mesh.getObjectByName('CandleFlame-1')?.visible, true)

  const outer = mesh.getObjectByName('CandleFlameOuter')
  const flame = mesh.getObjectByName('CandleFlame-1')
  const initialScale = outer.scale.clone()
  const anchoredX = flame.position.x
  params.poleFlameHeight = 1.4
  params.poleFlameWidth = 1.2
  emissive.update(0)
  assert.ok(outer.scale.y > initialScale.y)
  assert.ok(outer.scale.x > initialScale.x)
  emissive.update(0.25)
  assert.equal(flame.position.x, anchoredX)

  emissive.setUvDebug(true)
  assert.equal(mesh.getObjectByName('CandleFlame-1')?.visible, false)

  emissive.setUvDebug(false)
  assert.equal(mesh.material.name, 'pole-emission')
  assert.equal(mesh.getObjectByName('CandleFlame-1')?.visible, true)
})

test('normal variant identifies emissive meshes by material instead of baked mesh names', () => {
  const emissive = createEmissiveSystem(params)
  const metal = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  metal.name = 'Cube014'
  metal.material.name = 'metal'
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  lantern.name = 'Cube015'
  lantern.material.name = 'lampLight'

  assert.equal(emissive.tryAttach(metal, 'normal'), false)
  assert.equal(emissive.tryAttach(lantern, 'normal'), true)
  assert.equal(lantern.material.name, 'pole-emission')
})

test('local lights are enabled only on the active scene variant', () => {
  const emissive = createEmissiveSystem(params)
  const bakedPortal = new THREE.Mesh(new THREE.CircleGeometry(), new THREE.MeshBasicMaterial())
  bakedPortal.name = 'Circle'
  const normalPortal = new THREE.Mesh(new THREE.CircleGeometry(), new THREE.MeshBasicMaterial())
  normalPortal.name = 'Circle'
  normalPortal.material.name = 'portalLight'

  emissive.tryAttach(bakedPortal, 'baked')
  emissive.tryAttach(normalPortal, 'normal')
  emissive.setLocalLightsEnabled(true)
  assert.equal(emissive.attachments[0].light.visible, true)
  assert.equal(emissive.attachments[1].light.visible, false)

  emissive.setActiveVariant('normal')
  assert.equal(emissive.attachments[0].light.visible, false)
  assert.equal(emissive.attachments[1].light.visible, true)
})

test('candle flicker stays restrained and differs between lantern phases', () => {
  let phaseDifferenceSeen = false

  for (let step = 0; step <= 240; step += 1) {
    const elapsed = step / 30
    const first = calculateCandleFlicker(elapsed, 0.73)
    const second = calculateCandleFlicker(elapsed, 3.91)

    assert.ok(first.shell >= 0.9 && first.shell <= 1.08)
    assert.ok(first.light >= 0.84 && first.light <= 1.12)
    assert.ok(first.stretch >= 0.86 && first.stretch <= 1.1)
    if (Math.abs(first.light - second.light) > 0.01) phaseDifferenceSeen = true
  }

  assert.equal(phaseDifferenceSeen, true)
})

test('flame distortion anchors the root and increases toward the tip', () => {
  const bend = 0.06
  assert.equal(calculateFlameDistortion(0, bend, 0.02), 0)
  assert.ok(
    Math.abs(calculateFlameDistortion(0.8, bend, 0))
    > Math.abs(calculateFlameDistortion(0.25, bend, 0)),
  )
  assert.equal(calculateFlameDistortion(1, bend, 0), bend)
})
