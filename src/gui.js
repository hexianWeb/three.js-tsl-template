/**
 * Inspector panel for texture switching.
 */
export function setupInspector(inspector, onTextureChange, hexGrid) {
  const params = {
    texture: 'texture1',
  }

  const group = inspector.createParameters('Texture')
  group
    .add(params, 'texture', { texture1: 'texture1', texture2: 'texture2', hexGrid: 'hexGrid' })
    .name('Select Texture')
    .listen()

  // Hex grid controls
  const hexParams = {
    hexScale: hexGrid.hexScale.value,
    lineWidth: hexGrid.lineWidth.value,
    displayMode: hexGrid.displayMode.value,
    distancePow: hexGrid.distancePow.value,
  }

  const hexGroup = inspector.createParameters('Hex Grid')
  hexGroup
    .addSlider(hexParams, 'hexScale', 0.02, 0.3, 0.005)
    .name('Scale')
    .listen()

  hexGroup
    .addSlider(hexParams, 'lineWidth', 0.001, 0.1, 0.001)
    .name('Line Width')
    .listen()

  hexGroup
    .add(hexParams, 'displayMode', { Lines: 0, 'Distance Field': 1 })
    .name('Display Mode')
    .listen()

  hexGroup
    .addSlider(hexParams, 'distancePow', 0.1, 5.0, 0.05)
    .name('Distance Pow')
    .listen()

  // Distortion controls
  const distortParams = {
    distortionStrength: hexGrid.distortionStrength.value,
    distortionPower: hexGrid.distortionPower.value,
  }

  const distortGroup = inspector.createParameters('Barrel Distortion')
  distortGroup
    .addSlider(distortParams, 'distortionStrength', -1, 1.0, 0.01)
    .name('Strength')
    .listen()

  distortGroup
    .addSlider(distortParams, 'distortionPower', 0.5, 3.0, 0.05)
    .name('Power')
    .listen()

  const transitionParams = {
    process: hexGrid.transition.value
  }

  const transitionGroup = inspector.createParameters('transitionGroup')
  transitionGroup.addSlider(transitionParams, 'process', 0, 1.0, 0.01)
  .name('Process')
  .listen()

  // Poll for changes
  let lastValue = params.texture
  let lastScale = hexParams.hexScale
  let lastWidth = hexParams.lineWidth
  let lastMode = hexParams.displayMode
  let lastDistPow = hexParams.distancePow
  let lastStrength = distortParams.distortionStrength
  let lastPower = distortParams.distortionPower
  let lastProcess = transitionParams.process

  function checkChange() {
    if (params.texture !== lastValue) {
      lastValue = params.texture
      onTextureChange(params.texture)
    }
    if (hexParams.hexScale !== lastScale) {
      lastScale = hexParams.hexScale
      hexGrid.hexScale.value = lastScale
    }
    if (hexParams.lineWidth !== lastWidth) {
      lastWidth = hexParams.lineWidth
      hexGrid.lineWidth.value = lastWidth
    }
    if (hexParams.displayMode !== lastMode) {
      lastMode = hexParams.displayMode
      hexGrid.displayMode.value = lastMode
    }
    if (hexParams.distancePow !== lastDistPow) {
      lastDistPow = hexParams.distancePow
      hexGrid.distancePow.value = lastDistPow
    }
    if (distortParams.distortionStrength !== lastStrength) {
      lastStrength = distortParams.distortionStrength
      hexGrid.distortionStrength.value = lastStrength
    }
    if (distortParams.distortionPower !== lastPower) {
      lastPower = distortParams.distortionPower
      hexGrid.distortionPower.value = lastPower
    }
    if (transitionParams.process !== lastProcess) {
      lastProcess = transitionParams.process
      hexGrid.transition.value = lastProcess 
    }
    requestAnimationFrame(checkChange)
  }
  checkChange()

  return group
}
