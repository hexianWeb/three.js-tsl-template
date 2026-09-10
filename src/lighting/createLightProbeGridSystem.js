import { LightProbeGridHelper } from 'three/addons/helpers/LightProbeGridHelper.js'
import { LightProbeGrid } from 'three/addons/lighting/LightProbeGrid.js'
import * as THREE from 'three/webgpu'
import { vec3 } from 'three/tsl'

export const PROBE_GRID_CONFIG = Object.freeze({
  padding: 0.2,
  resolution: Object.freeze([9, 5, 9]),
  helperSize: 0.08,
  bake: Object.freeze({
    cubemapSize: 16,
    near: 0.1,
    sampleCount: 256,
    bounces: 2,
  }),
})

export function normalizeProbeBounces(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return PROBE_GRID_CONFIG.bake.bounces

  return Math.min(3, Math.max(0, Math.round(numericValue)))
}

export function calculateProbeGridLayout(
  bounds,
  { padding = PROBE_GRID_CONFIG.padding, resolution = PROBE_GRID_CONFIG.resolution } = {},
) {
  if (bounds?.isBox3 !== true || bounds.isEmpty()) {
    throw new Error('LightProbeGrid requires non-empty unbaked scene bounds')
  }

  const size = bounds.getSize(new THREE.Vector3()).addScalar(padding * 2)
  const center = bounds.getCenter(new THREE.Vector3())
  const [widthProbes, heightProbes, depthProbes] = resolution

  return {
    center,
    size,
    resolution: new THREE.Vector3(widthProbes, heightProbes, depthProbes),
    far: Math.max(20, size.length() * 2),
  }
}

export function createLightProbeGridSystem({
  scene,
  renderer,
  bounds,
  params,
  sharedEffects,
}) {
  const layout = calculateProbeGridLayout(bounds)
  const grid = new LightProbeGrid(
    layout.size.x,
    layout.size.y,
    layout.size.z,
    layout.resolution.x,
    layout.resolution.y,
    layout.resolution.z,
  )
  grid.name = 'CaseE-LightProbeGrid'
  grid.position.copy(layout.center)
  grid.intensity = params.probeIntensity
  grid.falloff = 0
  grid.visible = false
  scene.add(grid)

  let helper = null
  let enabled = false
  let baked = false
  let bakeCount = 0
  let lastBakeDurationMs = null
  let lastBounces = null

  function syncVisibility() {
    grid.visible = enabled && baked
    if (helper) {
      helper.visible = enabled && baked && params.showProbeHelper
    }
  }

  function bake() {
    const firefliesWereVisible = sharedEffects.fireflies.visible
    const uvDebugWasVisible = sharedEffects.emissive.uvDebugVisible
    const startTime = globalThis.performance?.now() ?? Date.now()
    const bounces = normalizeProbeBounces(params.probeBounces)

    sharedEffects.fireflies.visible = false
    sharedEffects.setUvDebug(false)
    if (helper) helper.visible = false

    try {
      grid.intensity = params.probeIntensity
      grid.bake(renderer, scene, {
        ...PROBE_GRID_CONFIG.bake,
        bounces,
        far: layout.far,
      })
      baked = true
      bakeCount += 1
      lastBounces = bounces

      if (!helper) {
        helper = new LightProbeGridHelper(grid, PROBE_GRID_CONFIG.helperSize)
        // The helper's custom fragment bypasses NodeMaterial's MRT setup.
        // Use outputNode so both the direct renderer and SSGI's color/normal/
        // diffuse attachments retain the probe's original SH visualization.
        helper.material.outputNode = helper.material.fragmentNode
        helper.material.fragmentNode = null
        helper.material.colorNode = vec3(0)
        helper.name = 'CaseE-LightProbeGridHelper'
        scene.add(helper)
      }
      else {
        helper.update()
      }
    }
    finally {
      lastBakeDurationMs = (globalThis.performance?.now() ?? Date.now()) - startTime
      sharedEffects.fireflies.visible = firefliesWereVisible
      sharedEffects.setUvDebug(uvDebugWasVisible)
      syncVisibility()
    }

    return {
      bakeCount,
      durationMs: lastBakeDurationMs,
      probes: grid.resolution.x * grid.resolution.y * grid.resolution.z,
      bounces: lastBounces,
    }
  }

  return {
    grid,
    bake,
    setEnabled(value) {
      enabled = value === true
      syncVisibility()
    },
    update() {
      grid.intensity = params.probeIntensity
      syncVisibility()
    },
    get helper() {
      return helper
    },
    get status() {
      return {
        enabled,
        baked,
        bakeCount,
        lastBakeDurationMs,
        configuredBounces: normalizeProbeBounces(params.probeBounces),
        lastBounces,
        resolution: grid.resolution.toArray(),
        size: layout.size.toArray(),
        center: layout.center.toArray(),
      }
    },
  }
}
