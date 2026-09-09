import * as THREE from 'three/webgpu'
import { uniform } from 'three/tsl'
import { createEmissionUvMaterial, createEmissionUvOverlay } from './emissionUvDebug.js'
import { createPortalEffect, preparePortalCoordinates } from './portalEffect.js'

const EMISSIVE_MESH_NAMES = new Set(['Circle', 'Cube.011', 'Cube.014', 'Cube011', 'Cube014'])
const EMISSIVE_MATERIAL_NAMES = new Set(['portalLight', 'lampLight'])

function isEmissiveMesh(mesh) {
  if (EMISSIVE_MESH_NAMES.has(mesh.name)) {
    return true
  }
  return EMISSIVE_MATERIAL_NAMES.has(mesh.material?.name)
}

function isPortalMesh(mesh) {
  return mesh.name === 'Circle' || mesh.material?.name === 'portalLight'
}

export function createEmissive(params) {
  const lights = []

  const uPoleColor = uniform(new THREE.Color(params.poleColor))
  const uPoleIntensity = uniform(params.poleIntensity)

  const portalEffect = createPortalEffect(params)
  const portalMaterial = portalEffect.material

  const poleMaterial = new THREE.MeshBasicNodeMaterial()
  poleMaterial.name = 'pole-emission'
  poleMaterial.colorNode = uPoleColor.mul(uPoleIntensity)
  const uvDebugMaterial = createEmissionUvMaterial()
  const uvOverlay = createEmissionUvOverlay()
  let uvDebugVisible = false
  let elapsedSeconds = 0

  function tryAttach(mesh) {
    if (!isEmissiveMesh(mesh)) {
      return false
    }

    const kind = isPortalMesh(mesh) ? 'portal' : 'pole'
    if (kind === 'portal') preparePortalCoordinates(mesh.geometry)
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.material = kind === 'portal' ? portalMaterial : poleMaterial

    const light = new THREE.PointLight(
      kind === 'portal' ? params.portalColor : params.poleColor,
      kind === 'portal' ? params.portalIntensity : params.poleIntensity,
    )
    light.distance = 12
    light.decay = 2
    light.castShadow = false
    mesh.add(light)
    lights.push({ kind, mesh, light })
    uvOverlay.addMesh(mesh)
    return true
  }

  function sync(deltaSeconds = 0) {
    elapsedSeconds += deltaSeconds
    uPoleColor.value.set(params.poleColor)
    uPoleIntensity.value = params.poleIntensity
    portalEffect.sync()

    for (const { kind, light } of lights) {
      const isPortal = kind === 'portal'
      light.color.set(isPortal ? params.portalColor : params.poleColor)
      const portalPulse = 0.84 + (Math.sin(elapsedSeconds * Math.PI * 2 / 3.5) * 0.5 + 0.5) * 0.16
      light.intensity = isPortal
        ? params.portalIntensity * portalPulse
        : params.poleIntensity
    }
  }

  function setLightsVisible(visible) {
    for (const { light } of lights) {
      light.visible = visible
    }
  }

  function setUvDebug(visible) {
    uvDebugVisible = visible
    uvOverlay.setVisible(visible)
    for (const { kind, mesh } of lights) {
      mesh.material = uvDebugVisible
        ? uvDebugMaterial
        : kind === 'portal' ? portalMaterial : poleMaterial
    }
  }

  return { lights, tryAttach, sync, setLightsVisible, setUvDebug }
}
