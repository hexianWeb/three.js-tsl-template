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
    lightProbeGrid: false,
    supportsSunAnimation: false,
  }),
  B: defineCase({
    id: 'B',
    label: 'B Indirect + Direct',
    sceneVariant: 'baked',
    surfaceStrategy: 'indirectLightmap',
    directionalLight: true,
    emissiveLights: true,
    lightProbeGrid: false,
    supportsSunAnimation: true,
  }),
  C: defineCase({
    id: 'C',
    label: 'C Indirect Only',
    sceneVariant: 'baked',
    surfaceStrategy: 'indirectLightmap',
    directionalLight: false,
    emissiveLights: false,
    lightProbeGrid: false,
    supportsSunAnimation: false,
  }),
  D: defineCase({
    id: 'D',
    label: 'D Normal PBR + Direct',
    sceneVariant: 'unbaked',
    surfaceStrategy: 'normalPbr',
    directionalLight: true,
    emissiveLights: true,
    lightProbeGrid: false,
    supportsSunAnimation: true,
  }),
  E: defineCase({
    id: 'E',
    label: 'E Realtime + Light Probe Grid',
    sceneVariant: 'unbaked',
    surfaceStrategy: 'normalPbr',
    directionalLight: true,
    emissiveLights: true,
    lightProbeGrid: true,
    supportsSunAnimation: true,
  }),
  F: defineCase({
    id: 'F',
    label: 'F Light Probe Grid + SSGI',
    sceneVariant: 'unbaked',
    surfaceStrategy: 'normalPbr',
    directionalLight: true,
    emissiveLights: true,
    lightProbeGrid: true,
    ssgi: true,
    supportsSunAnimation: true,
  }),
  G: defineCase({
    id: 'G',
    label: 'G Light Probe Grid + SSGI + GTAO',
    sceneVariant: 'unbaked',
    surfaceStrategy: 'normalPbr',
    directionalLight: true,
    emissiveLights: true,
    lightProbeGrid: true,
    ssgi: true,
    gtao: true,
    supportsSunAnimation: true,
  }),
  H: defineCase({
    id: 'H',
    label: 'H Lightmap + Light Probe Grid + Direct',
    sceneVariant: 'baked',
    surfaceStrategy: 'indirectLightmap',
    directionalLight: true,
    emissiveLights: false,
    lightProbeGrid: true,
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
