import {
  createFullBakeMaterial,
  createIndirectMaterialLibrary,
} from '../lighting/surfaceMaterials.js'
import { getCaseDefinition } from './caseDefinitions.js'

export function createExperimentController({
  params,
  roots,
  bakedSurfaceMeshes,
  lightmaps,
  directionalLight,
  dayNight,
  sharedEffects,
}) {
  const fullBakeMaterial = createFullBakeMaterial(lightmaps.fullBake)
  const indirectMaterials = createIndirectMaterialLibrary(lightmaps.indirect)
  let activeCase = null

  function applySurfaceStrategy(definition) {
    if (definition.surfaceStrategy === 'normalPbr') {
      return
    }

    for (const mesh of bakedSurfaceMeshes) {
      mesh.material = definition.surfaceStrategy === 'fullBake'
        ? fullBakeMaterial
        : indirectMaterials.get(mesh.name, params.lightMapIntensity)
    }
  }

  function syncSunMode() {
    dayNight.setAnimated(
      activeCase?.supportsSunAnimation === true && params.animateSun === true,
    )
  }

  function applyCase(caseId) {
    const definition = getCaseDefinition(caseId)
    activeCase = definition
    params.caseId = definition.id

    for (const [variantId, root] of Object.entries(roots)) {
      root.visible = variantId === definition.sceneVariant
    }

    applySurfaceStrategy(definition)
    directionalLight.visible = definition.directionalLight
    sharedEffects.setActiveVariant(definition.sceneVariant)
    sharedEffects.setLocalLightsEnabled(definition.emissiveLights)
    syncSunMode()
    dayNight.update(0)

    return definition
  }

  return {
    applyCase,
    update(deltaSeconds) {
      if (!activeCase) return

      syncSunMode()
      dayNight.update(deltaSeconds)
      sharedEffects.update(deltaSeconds)

      if (activeCase.surfaceStrategy === 'indirectLightmap') {
        indirectMaterials.setIntensity(params.lightMapIntensity)
      }
    },
    get activeCase() {
      return activeCase
    },
    get indirectMaterials() {
      return indirectMaterials.materials
    },
  }
}
