import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three/webgpu'

import { createExperimentController } from '../src/experiment/createExperimentController.js'
import {
  CASE_DEFINITIONS,
  SHARED_PRESENTATION,
} from '../src/experiment/caseDefinitions.js'

function createTexture() {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  texture.needsUpdate = true
  return texture
}

test('case manifest keeps the GI ablation matrix readable in one place', () => {
  assert.deepEqual(
    Object.values(CASE_DEFINITIONS).map((definition) => ({
      id: definition.id,
      scene: definition.sceneVariant,
      surface: definition.surfaceStrategy,
      direct: definition.directionalLight,
      local: definition.emissiveLights,
    })),
    [
      { id: 'A', scene: 'baked', surface: 'fullBake', direct: false, local: false },
      { id: 'B', scene: 'baked', surface: 'indirectLightmap', direct: true, local: true },
      { id: 'C', scene: 'baked', surface: 'indirectLightmap', direct: false, local: false },
      { id: 'D', scene: 'normal', surface: 'normalPbr', direct: true, local: true },
    ],
  )
  assert.equal(SHARED_PRESENTATION.emissiveAppearance, true)
  assert.equal(SHARED_PRESENTATION.fireflies, true)
  assert.equal(SHARED_PRESENTATION.background, '#000000')
})

test('controller changes only the capabilities declared by each case', () => {
  const roots = {
    baked: new THREE.Group(),
    normal: new THREE.Group(),
  }
  const surfaceMesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())
  surfaceMesh.name = 'Plane'
  roots.baked.add(surfaceMesh)

  const params = {
    caseId: 'A',
    lightMapIntensity: Math.PI,
    directIntensity: 2.5,
    animateSun: false,
  }
  const directionalLight = new THREE.DirectionalLight()
  const state = {
    animated: [],
    activeVariants: [],
    localLights: [],
  }
  const controller = createExperimentController({
    params,
    roots,
    bakedSurfaceMeshes: [surfaceMesh],
    lightmaps: {
      fullBake: createTexture(),
      indirect: createTexture(),
    },
    directionalLight,
    dayNight: {
      setAnimated: (value) => state.animated.push(value),
      update() {},
    },
    sharedEffects: {
      setActiveVariant: (value) => state.activeVariants.push(value),
      setLocalLightsEnabled: (value) => state.localLights.push(value),
      update() {},
    },
  })

  controller.applyCase('A')
  assert.equal(roots.baked.visible, true)
  assert.equal(roots.normal.visible, false)
  assert.equal(directionalLight.visible, false)
  assert.equal(surfaceMesh.material.name, 'full-bake-surface')

  controller.applyCase('B')
  assert.equal(directionalLight.visible, true)
  assert.equal(surfaceMesh.material.name, 'indirect-grass')
  assert.equal(state.localLights.at(-1), true)

  params.animateSun = true
  controller.update(1 / 60)
  assert.equal(state.animated.at(-1), true)

  controller.applyCase('C')
  assert.equal(directionalLight.visible, false)
  assert.equal(state.localLights.at(-1), false)
  assert.equal(state.animated.at(-1), false)

  controller.applyCase('D')
  assert.equal(roots.baked.visible, false)
  assert.equal(roots.normal.visible, true)
  assert.equal(directionalLight.visible, true)
  assert.equal(state.activeVariants.at(-1), 'normal')
  assert.equal(state.localLights.at(-1), true)
  assert.equal(state.animated.at(-1), true)
})
