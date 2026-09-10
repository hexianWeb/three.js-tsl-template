import * as THREE from 'three/webgpu'
import { float, uniform } from 'three/tsl'
import { createEmissionUvMaterial, createEmissionUvOverlay } from '../../debug/emissionUvDebug.js'
import { createCandleFlame } from './createCandleFlame.js'
import { createPortalEffect, preparePortalCoordinates } from './createPortalEffect.js'

const EMISSIVE_MESH_NAMES = new Set(['Circle', 'Cube.011', 'Cube.014', 'Cube011', 'Cube014'])
const EMISSIVE_MATERIAL_NAMES = new Set(['portalLight', 'lampLight'])

function isEmissiveMesh(mesh, variantId) {
  if (variantId === 'unbaked') {
    return EMISSIVE_MATERIAL_NAMES.has(mesh.material?.name)
  }
  return EMISSIVE_MESH_NAMES.has(mesh.name)
    || EMISSIVE_MATERIAL_NAMES.has(mesh.material?.name)
}

function isPortalMesh(mesh) {
  return mesh.name === 'Circle' || mesh.material?.name === 'portalLight'
}

export function createEmissiveSystem(params) {
  const attachments = []
  const candles = []
  const uPoleColor = uniform(new THREE.Color(params.poleColor))
  const uPoleIntensity = uniform(params.poleIntensity)
  const portalEffect = createPortalEffect(params)
  const uvDebugMaterial = createEmissionUvMaterial()
  const uvOverlay = createEmissionUvOverlay()
  let localLightsEnabled = false
  let activeVariant = 'baked'
  let uvDebugVisible = false
  let elapsedSeconds = 0

  function syncLocalLightVisibility() {
    for (const attachment of attachments) {
      attachment.light.visible
        = localLightsEnabled && attachment.variantId === activeVariant
    }
  }

  function tryAttach(mesh, variantId) {
    if (!isEmissiveMesh(mesh, variantId)) return false

    const kind = isPortalMesh(mesh) ? 'portal' : 'pole'
    if (kind === 'portal') preparePortalCoordinates(mesh.geometry)
    mesh.castShadow = false
    mesh.receiveShadow = false

    let candle = null
    let poleFlicker = null
    let emissionMaterial = portalEffect.material
    if (kind === 'portal') {
      mesh.material = emissionMaterial
    }
    else {
      poleFlicker = uniform(1)
      emissionMaterial = new THREE.MeshBasicNodeMaterial()
      emissionMaterial.name = 'pole-emission'
      emissionMaterial.colorNode = uPoleColor.mul(uPoleIntensity).mul(poleFlicker)
      emissionMaterial.opacityNode = float(0.58)
      emissionMaterial.transparent = true
      emissionMaterial.blending = THREE.AdditiveBlending
      emissionMaterial.depthWrite = false
      mesh.material = emissionMaterial
      mesh.renderOrder = 1
      candle = createCandleFlame({
        mesh,
        index: candles.length,
        params,
        uPoleColor,
        uPoleIntensity,
      })
      candles.push(candle)
    }

    const light = new THREE.PointLight(
      kind === 'portal' ? params.portalColor : params.poleColor,
      kind === 'portal' ? params.portalIntensity : params.poleIntensity,
    )
    light.distance = kind === 'portal' ? 12 : 1.8
    light.decay = 2
    light.castShadow = false
    light.visible = localLightsEnabled && variantId === activeVariant
    mesh.add(light)

    attachments.push({
      variantId,
      kind,
      mesh,
      light,
      candle,
      poleFlicker,
      emissionMaterial,
    })
    uvOverlay.addMesh(mesh, variantId)
    return true
  }

  function update(deltaSeconds = 0) {
    elapsedSeconds += deltaSeconds
    uPoleColor.value.set(params.poleColor)
    uPoleIntensity.value = params.poleIntensity
    portalEffect.sync()

    for (const { kind, light, candle, poleFlicker } of attachments) {
      const isPortal = kind === 'portal'
      light.color.set(isPortal ? params.portalColor : params.poleColor)
      const portalPulse
        = 0.84 + (Math.sin(elapsedSeconds * Math.PI * 2 / 3.5) * 0.5 + 0.5) * 0.16
      if (isPortal) {
        light.intensity = params.portalIntensity * portalPulse
      }
      else {
        const flicker = candle.update(elapsedSeconds)
        poleFlicker.value = flicker.shell
        light.intensity = params.poleIntensity * flicker.light
      }
    }
  }

  function setLocalLightsEnabled(enabled) {
    localLightsEnabled = enabled === true
    syncLocalLightVisibility()
  }

  function setActiveVariant(variantId) {
    activeVariant = variantId
    uvOverlay.setActiveVariant(variantId)
    syncLocalLightVisibility()
  }

  function setUvDebug(visible) {
    uvDebugVisible = visible === true
    uvOverlay.setVisible(uvDebugVisible)
    for (const { mesh, candle, emissionMaterial } of attachments) {
      mesh.material = uvDebugVisible ? uvDebugMaterial : emissionMaterial
      candle?.setVisible(!uvDebugVisible)
    }
  }

  return {
    attachments,
    tryAttach,
    update,
    setLocalLightsEnabled,
    setUvDebug,
    setActiveVariant,
    get uvDebugVisible() {
      return uvDebugVisible
    },
  }
}
