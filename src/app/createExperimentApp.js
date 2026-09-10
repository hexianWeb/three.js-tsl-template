import * as THREE from 'three/webgpu'
import { createSharedEffects } from '../effects/createSharedEffects.js'
import { createExperimentController } from '../experiment/createExperimentController.js'
import { createDayNightCycle } from '../lighting/dayNightCycle.js'
import { createLightProbeGridSystem } from '../lighting/createLightProbeGridSystem.js'
import { createLightingRig } from '../lighting/createLightingRig.js'
import { createRenderer } from '../rendering/createRenderer.js'
import { createSsgiPipeline } from '../rendering/createSsgiPipeline.js'
import { loadLightmaps, loadModelVariants } from '../scene/loadExperimentAssets.js'
import { prepareSceneVariants } from '../scene/prepareSceneVariants.js'
import { setupGui } from '../ui/setupGui.js'
import { createExperimentParams } from './params.js'

export async function createExperimentApp() {
  const params = createExperimentParams()
  const { scene, directionalLight } = createLightingRig()
  const { camera, renderer, controls, startLoop } = createRenderer()
  const sharedEffects = createSharedEffects({ scene, params })
  const dayNight = createDayNightCycle({ scene, light: directionalLight, params })

  await renderer.init()

  const modelVariants = await loadModelVariants()
  const preparedScene = prepareSceneVariants({
    scene,
    modelVariants,
    camera,
    controls,
    directionalLight,
    sharedEffects,
  })
  const lightmaps = await loadLightmaps()
  const lightProbeGrid = createLightProbeGridSystem({
    scene,
    renderer,
    bounds: preparedScene.boundsByVariant.unbaked,
    params,
    sharedEffects,
  })
  const controller = createExperimentController({
    params,
    roots: preparedScene.roots,
    bakedSurfaceMeshes: preparedScene.bakedSurfaceMeshes,
    lightmaps,
    directionalLight,
    dayNight,
    sharedEffects,
    lightProbeGrid,
  })

  controller.applyCase(params.caseId)

  function bakeLightProbes() {
    const previousCaseId = controller.activeCase?.id ?? params.caseId
    controller.applyCase('E')
    try {
      return lightProbeGrid.bake()
    }
    finally {
      controller.applyCase(previousCaseId)
    }
  }

  const initialProbeBake = bakeLightProbes()
  const ssgiPipeline = createSsgiPipeline({ renderer, scene, camera, params })
  const pane = setupGui({
    params,
    onCaseChange: controller.applyCase,
    onEmissionUvChange: sharedEffects.setUvDebug,
    onRebakeProbes: bakeLightProbes,
  })

  startLoop(scene, (deltaSeconds) => {
    renderer.toneMapping = params.toneMapping === 'agx'
      ? THREE.AgXToneMapping
      : THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = params.exposure
    controller.update(deltaSeconds)
  }, () => {
    if (controller.activeCase.ssgi && params.ssgiEnabled) ssgiPipeline.render()
    else renderer.render(scene, camera)
  })

  const debugApi = {
    scene,
    camera,
    renderer,
    directionalLight,
    params,
    controller,
    roots: preparedScene.roots,
    meshEntries: preparedScene.bakedSurfaceMeshes,
    meshCount: preparedScene.bakedSurfaceMeshes.length,
    emissiveLights: sharedEffects.emissive.attachments,
    fireflies: sharedEffects.fireflies,
    lightProbeGrid,
    initialProbeBake,
    mapsReady: true,
    pane,
    maps: {
      full: [lightmaps.fullBake.image.width, lightmaps.fullBake.image.height],
      indirect: [lightmaps.indirect.image.width, lightmaps.indirect.image.height],
    },
    box: preparedScene.bounds.getSize(new THREE.Vector3()).toArray(),
    get probeStatus() {
      return lightProbeGrid.status
    },
  }
  window.__portal = debugApi
  return debugApi
}
