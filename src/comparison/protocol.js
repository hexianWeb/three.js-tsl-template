import { CASE_DEFINITIONS } from '../experiment/caseDefinitions.js'

export const CHANNEL = 'gi-comparison-v1'
export const CLOCK_QUERY = 'clock'

export function parseClockEpoch(value) {
  if (value == null || value === '') return null
  const epoch = Number(value)
  return Number.isFinite(epoch) ? epoch : null
}

export function isCaseId(value) {
  return typeof value === 'string' && Object.hasOwn(CASE_DEFINITIONS, value)
}

export function isCameraState(value) {
  const vector = (v, length) => Array.isArray(v) && v.length === length && v.every(Number.isFinite)
  return value != null && vector(value.position, 3) && vector(value.target, 3)
    && vector(value.up, 3) && Number.isFinite(value.fov) && value.fov > 0 && value.fov < 180
    && Number.isFinite(value.zoom) && value.zoom > 0
}

// Case selection stays independent. Animation time comes from a shared wall clock.
export function getSharedParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'caseId'))
}

export function applySharedParams(params, values) {
  if (!values || typeof values !== 'object') return
  for (const key of Object.keys(getSharedParams(params))) {
    const value = values[key]
    if (typeof value !== typeof params[key]) continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    params[key] = value
  }
}
