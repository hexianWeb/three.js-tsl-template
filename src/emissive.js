import * as THREE from 'three/webgpu'
import { uniform } from 'three/tsl'
import { createEmissionUvMaterial, createEmissionUvOverlay } from './emissionUvDebug.js'

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

  const uPortalColor = uniform(new THREE.Color(params.portalColor))
  const uPortalIntensity = uniform(params.portalIntensity)
  const uPoleColor = uniform(new THREE.Color(params.poleColor))
  const uPoleIntensity = uniform(params.poleIntensity)

  const portalMaterial = new THREE.MeshBasicNodeMaterial()
  portalMaterial.name = 'portal-emission'
  portalMaterial.colorNode = uPortalColor.mul(uPortalIntensity)

  const poleMaterial = new THREE.MeshBasicNodeMaterial()
  poleMaterial.name = 'pole-emission'
  poleMaterial.colorNode = uPoleColor.mul(uPoleIntensity)
  const uvDebugMaterial = createEmissionUvMaterial()
  const uvOverlay = createEmissionUvOverlay()
  let uvDebugVisible = true

  function tryAttach(mesh) {
    if (!isEmissiveMesh(mesh)) {
      return false
    }

    const kind = isPortalMesh(mesh) ? 'portal' : 'pole'
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.material = uvDebugMaterial

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

  function sync() {
    uPortalColor.value.set(params.portalColor)
    uPortalIntensity.value = params.portalIntensity
    uPoleColor.value.set(params.poleColor)
    uPoleIntensity.value = params.poleIntensity

    for (const { kind, light } of lights) {
      const isPortal = kind === 'portal'
      light.color.set(isPortal ? params.portalColor : params.poleColor)
      light.intensity = isPortal ? params.portalIntensity : params.poleIntensity
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
