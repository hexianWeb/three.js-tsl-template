import { Pane } from 'tweakpane'
import * as THREE from 'three/webgpu'
import { createNodeMaterial } from './material.js'
import './style.css'

const canvas = document.querySelector('.webgl')
const panelElement = document.querySelector('.debug-panel')
const unsupportedElement = document.querySelector('.unsupported')

async function createWebGPUScene() {
  if (!navigator.gpu) {
    canvas.hidden = true
    panelElement.hidden = true
    unsupportedElement.hidden = false
    return null
  }

  const scene = new THREE.Scene()
  const params = {
    background: '#0d1117',
    colorTop: '#7c3aed',
    colorBottom: '#22d3ee',
    metalness: 0.65,
    roughness: 0.22,
    rotationSpeed: 0.35,
    wireframe: false,
  }
  scene.background = new THREE.Color(params.background)

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 0, 4.5)

  const geometry = new THREE.TorusKnotGeometry(1, 0.3, 192, 32)
  const { material, uniforms } = createNodeMaterial({
    colorTop: params.colorTop,
    colorBottom: params.colorBottom,
    metalness: params.metalness,
    roughness: params.roughness,
  })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  scene.add(new THREE.HemisphereLight('#ffffff', '#172033', 1.8))
  const keyLight = new THREE.DirectionalLight('#ffffff', 4)
  keyLight.position.set(3, 4, 5)
  scene.add(keyLight)

  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    canvas,
    forceWebGL: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  await renderer.init()

  const pane = new Pane({
    container: panelElement,
    title: 'WebGPU Render',
  })

  const appearanceFolder = pane.addFolder({ title: 'Appearance' })
  appearanceFolder.addBinding(params, 'colorTop', { label: 'Top color' })
    .on('change', ({ value }) => uniforms.colorTop.value.set(value))
  appearanceFolder.addBinding(params, 'colorBottom', { label: 'Bottom color' })
    .on('change', ({ value }) => uniforms.colorBottom.value.set(value))
  appearanceFolder.addBinding(params, 'metalness', { label: 'Metalness', min: 0, max: 1, step: 0.01 })
    .on('change', ({ value }) => { uniforms.metalness.value = value })
  appearanceFolder.addBinding(params, 'roughness', { label: 'Roughness', min: 0, max: 1, step: 0.01 })
    .on('change', ({ value }) => { uniforms.roughness.value = value })
  appearanceFolder.addBinding(params, 'wireframe', { label: 'Wireframe' })
    .on('change', ({ value }) => {
      material.wireframe = value
      material.needsUpdate = true
    })

  const sceneFolder = pane.addFolder({ title: 'Scene' })
  sceneFolder.addBinding(params, 'background', { label: 'Background' })
    .on('change', ({ value }) => scene.background.set(value))
  sceneFolder.addBinding(params, 'rotationSpeed', { label: 'Rotation', min: 0, max: 2, step: 0.01 })

  const timer = new THREE.Timer()
  timer.connect(document)

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  function render() {
    timer.update()
    const elapsed = timer.getElapsed()
    mesh.rotation.x = elapsed * params.rotationSpeed * 0.35
    mesh.rotation.y = elapsed * params.rotationSpeed
    renderer.render(scene, camera)
  }

  window.addEventListener('resize', resize)
  renderer.setAnimationLoop(render)

  return function dispose() {
    window.removeEventListener('resize', resize)
    renderer.setAnimationLoop(null)
    timer.disconnect()
    pane.dispose()
    geometry.dispose()
    material.dispose()
    renderer.dispose()
  }
}

let disposeScene = null

createWebGPUScene()
  .then((dispose) => { disposeScene = dispose })
  .catch((error) => {
    console.error(error)
    canvas.hidden = true
    panelElement.hidden = true
    unsupportedElement.hidden = false
    unsupportedElement.textContent = 'WebGPU 初始化失败，请检查浏览器与显卡支持。'
  })

if (import.meta.hot) {
  import.meta.hot.dispose(() => disposeScene?.())
}
