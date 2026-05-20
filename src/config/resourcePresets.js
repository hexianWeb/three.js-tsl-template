/**
 * Resource presets for different grid sets.
 * Each preset defines atlas dimensions and the texture item names to use.
 * Keeps details centralized so switching is data-driven.
 */
export const RESOURCE_PRESETS = {
  object: {
    label: 'Object (6×6 WEBP)',
    columns: 6,
    rows: 6,
    rendered: 'renderedGridTex',
    motion: 'motionVectorGridTex',
    position: 'positionGridTex'
  },
  camera: {
    label: 'Camera (5×7 PNG)',
    columns: 5,
    rows: 7,
    rendered: 'renderedGridTexCamera',
    motion: 'motionVectorGridTexCamera',
    position: 'positionGridTexCamera'
  },
  gameboy: {
    label: 'Gameboy (4×4 KTX2)',
    columns: 4,
    rows: 4,
    rendered: 'renderedGridTexGameboy',
    alpha: 'alphaGridTexGameboy',
    motion: 'motionVectorGridTexGameboy',
    position: 'positionGridTexGameboy'
  },
  phone: {
    label: 'Phone (4×4 JPG)',
    columns: 4,
    rows: 4,
    rendered: 'renderedGridTexPhone',
    motion: 'motionVectorGridTexPhone'
  }
}

export const DEFAULT_PRESET = 'object'

/**
 * @param {string} presetKey
 */
export function getPreset(presetKey) {
  return RESOURCE_PRESETS[presetKey] || RESOURCE_PRESETS[DEFAULT_PRESET]
}

export function getPresetKeys() {
  return Object.keys(RESOURCE_PRESETS)
}
