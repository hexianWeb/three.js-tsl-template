function defineCase(definition) {
  return Object.freeze(definition)
}

/**
 * The ablation matrix. Anything absent from this table is shared presentation
 * and must not change when a case is activated.
 */
export const CASE_DEFINITIONS = Object.freeze({
  A: defineCase({
    id: 'A',
    label: 'A Full Bake',
    sceneVariant: 'baked',
    surfaceStrategy: 'fullBake',
    directionalLight: false,
    emissiveLights: false,
    supportsSunAnimation: false,
  }),
  B: defineCase({
    id: 'B',
    label: 'B Indirect + Direct',
    sceneVariant: 'baked',
    surfaceStrategy: 'indirectLightmap',
    directionalLight: true,
    emissiveLights: true,
    supportsSunAnimation: true,
  }),
  C: defineCase({
    id: 'C',
    label: 'C Indirect Only',
    sceneVariant: 'baked',
    surfaceStrategy: 'indirectLightmap',
    directionalLight: false,
    emissiveLights: false,
    supportsSunAnimation: false,
  }),
  D: defineCase({
    id: 'D',
    label: 'D Normal PBR + Direct',
    sceneVariant: 'normal',
    surfaceStrategy: 'normalPbr',
    directionalLight: true,
    emissiveLights: true,
    supportsSunAnimation: true,
  }),
})

export const SHARED_PRESENTATION = Object.freeze({
  emissiveAppearance: true,
  fireflies: true,
  camera: true,
  toneMapping: true,
  background: '#000000',
})

export function getCaseDefinition(caseId) {
  const definition = CASE_DEFINITIONS[caseId]
  if (!definition) {
    throw new Error(`Unknown experiment case: ${caseId}`)
  }
  return definition
}

export function getCaseOptions() {
  return Object.fromEntries(
    Object.values(CASE_DEFINITIONS).map(({ id, label }) => [label, id]),
  )
}
