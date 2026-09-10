import { createEmissiveSystem } from './emissive/createEmissiveSystem.js'
import { createFireflies, fireflyParams } from './fireflies.js'

/**
 * Presentation layer shared by every experiment case. Case switching may only
 * change the local-light contribution, never these visible effects.
 */
export function createSharedEffects({ scene, camera, params }) {
  const emissive = createEmissiveSystem(params)
  const fireflies = createFireflies({ scene, camera, params: fireflyParams })

  return {
    emissive,
    fireflies,
    attachEmissive: emissive.tryAttach,
    setActiveVariant: emissive.setActiveVariant,
    setLocalLightsEnabled: emissive.setLocalLightsEnabled,
    setUvDebug: emissive.setUvDebug,
    update(elapsedSeconds) {
      emissive.update(elapsedSeconds)
      fireflies.setElapsed(elapsedSeconds)
    },
  }
}
