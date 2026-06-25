import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import TerrainBrickRenderer from '../src/world/bricks/TerrainBrickRenderer.js'
import WaterBrickRenderer from '../src/world/bricks/WaterBrickRenderer.js'
import LavaBrickRenderer from '../src/world/bricks/LavaBrickRenderer.js'

const config = {
  terrain: {
    cellSize: 0.2,
    layerHeight: 1,
    waterLevel: 3
  },
  water: {}
}

test('terrain renderers can reuse shared materials without disposing them per chunk', () => {
  const material = new THREE.MeshBasicMaterial()
  const previewMaterial = new THREE.MeshBasicMaterial()
  let materialDisposed = false
  let previewDisposed = false
  material.dispose = () => {
    materialDisposed = true
  }
  previewMaterial.dispose = () => {
    previewDisposed = true
  }

  const renderer = new TerrainBrickRenderer({
    config,
    brickGeometry: new THREE.BoxGeometry(1, 1, 1),
    material,
    previewMaterial,
    ownsMaterials: false
  })

  assert.equal(renderer.material, material)
  assert.equal(renderer.previewMaterial, previewMaterial)

  renderer.dispose()

  assert.equal(materialDisposed, false)
  assert.equal(previewDisposed, false)
})

test('water and lava renderers can reuse shared materials without disposing them per chunk', () => {
  const waterMaterial = new THREE.MeshBasicMaterial()
  const lavaMaterial = new THREE.MeshBasicMaterial()
  let waterDisposed = false
  let lavaDisposed = false
  waterMaterial.dispose = () => {
    waterDisposed = true
  }
  lavaMaterial.dispose = () => {
    lavaDisposed = true
  }

  const water = new WaterBrickRenderer({
    config,
    brickGeometry: new THREE.BoxGeometry(1, 1, 1),
    material: waterMaterial,
    ownsMaterial: false
  })
  const lava = new LavaBrickRenderer({
    config,
    brickGeometry: new THREE.BoxGeometry(1, 1, 1),
    material: lavaMaterial,
    ownsMaterial: false
  })

  assert.equal(water.material, waterMaterial)
  assert.equal(lava.material, lavaMaterial)

  water.dispose()
  lava.dispose()

  assert.equal(waterDisposed, false)
  assert.equal(lavaDisposed, false)
})
