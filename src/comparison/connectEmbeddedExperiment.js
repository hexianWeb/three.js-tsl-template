import { CHANNEL, applySharedParams, getSharedParams, isCameraState, isCaseId } from './protocol.js'

export function connectEmbeddedExperiment({ camera, controls, params, controller, pane }) {
  let receiving = false
  const send = (type, payload) => window.parent.postMessage({ channel: CHANNEL, type, payload }, window.location.origin)
  const cameraState = () => ({
    position: camera.position.toArray(), target: controls.target.toArray(),
    up: camera.up.toArray(), fov: camera.fov, zoom: camera.zoom,
  })
  controls.addEventListener('start', () => send('camera-owner'))
  controls.addEventListener('change', () => {
    if (!receiving) send('camera', cameraState())
  })
  pane.on('change', () => {
    if (!receiving) {
      send('case-state', params.caseId)
      send('params', getSharedParams(params))
    }
  })
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return
    const { channel, type, payload } = event.data ?? {}
    if (channel !== CHANNEL) return
    receiving = true
    try {
      if (type === 'case' && isCaseId(payload)) {
        controller.applyCase(payload)
        pane.refresh()
      } else if (type === 'camera' && isCameraState(payload)) {
        // Drain local damping before applying the other viewport's pose.
        const damping = controls.enableDamping
        controls.enableDamping = false
        controls.update()
        camera.position.fromArray(payload.position)
        camera.up.fromArray(payload.up)
        camera.fov = payload.fov
        camera.zoom = payload.zoom
        controls.target.fromArray(payload.target)
        camera.updateProjectionMatrix()
        controls.update()
        controls.enableDamping = damping
      } else if (type === 'params') {
        applySharedParams(params, payload)
        pane.refresh()
      } else if (type === 'controls') {
        pane.hidden = !payload
      } else if (type === 'snapshot') {
        send('camera', cameraState())
        send('params', getSharedParams(params))
      }
    } finally {
      receiving = false
    }
  })
  send('ready', { camera: cameraState(), params: getSharedParams(params) })
}
