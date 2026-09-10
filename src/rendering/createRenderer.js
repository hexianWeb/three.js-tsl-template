import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as THREE from 'three/webgpu'

export function createRenderer() {
  const canvas = document.querySelector('canvas.webgl')
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(5.78, 5.26, 6.63)

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 1, 0)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  })

  return {
    camera,
    renderer,
    controls,
    startLoop(scene, onFrame, renderFrame = () => renderer.render(scene, camera)) {
      let previousTime = null
      renderer.setAnimationLoop((time) => {
        const deltaSeconds = previousTime === null ? 0 : (time - previousTime) / 1000
        previousTime = time
        onFrame(deltaSeconds)
        controls.update()
        renderFrame()
      })
    },
  }
}
