import * as THREE from 'three/webgpu'
import { createSharedEffects } from '../effects/createSharedEffects.js'
import { createExperimentController } from '../experiment/createExperimentController.js'
import { createDayNightCycle } from '../lighting/dayNightCycle.js'
import { createLightingRig } from '../lighting/createLightingRig.js'
import { createRenderer } from '../rendering/createRenderer.js'
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
  const controller = createExperimentController({
    params,
    roots: preparedScene.roots,
    bakedSurfaceMeshes: preparedScene.bakedSurfaceMeshes,
    lightmaps,
    directionalLight,
    dayNight,
    sharedEffects,
  })

  controller.applyCase(params.caseId)
  const pane = setupGui({
    params,
    onCaseChange: controller.applyCase,
    onEmissionUvChange: sharedEffects.setUvDebug,
  })

  startLoop(scene, (deltaSeconds) => {
    renderer.toneMapping = params.toneMapping === 'agx'
      ? THREE.AgXToneMapping
      : THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = params.exposure
    controller.update(deltaSeconds)
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
    mapsReady: true,
    pane,
    maps: {
      full: [lightmaps.fullBake.image.width, lightmaps.fullBake.image.height],
      indirect: [lightmaps.indirect.image.width, lightmaps.indirect.image.height],
    },
    box: preparedScene.bounds.getSize(new THREE.Vector3()).toArray(),
  }
  window.__portal = debugApi
  return debugApi
}
