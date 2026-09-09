import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three/webgpu'

import { createEmissive } from '../src/emissive.js'

const params = {
  portalColor: '#ffffff',
  portalIntensity: 1,
  portalSpeed: 0.28,
  poleColor: '#ff4e18',
  poleIntensity: 1,
}

test('emissive meshes start in emission view and can switch to UV debug', () => {
  const emissive = createEmissive(params)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())
  mesh.name = 'Circle'

  assert.equal(emissive.tryAttach(mesh), true)
  assert.equal(mesh.material.name, 'portal-emission')

  emissive.setUvDebug(true)
  assert.equal(mesh.material.name, 'emission-uv-debug')

  emissive.setUvDebug(false)
  assert.equal(mesh.material.name, 'portal-emission')
})

test('GLTF-normalized lantern names are included in the UV debug view', () => {
  const emissive = createEmissive(params)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  mesh.name = 'Cube011'

  assert.equal(emissive.tryAttach(mesh), true)
  assert.equal(mesh.material.name, 'pole-emission')
})
