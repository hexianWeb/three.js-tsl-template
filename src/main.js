import { Inspector } from 'three/addons/inspector/Inspector.js'
import { texture as tslTexture, uv, pass, renderOutput } from 'three/tsl'
import * as THREE from 'three/webgpu'
import { setupInspector } from './gui.js'
import { startLoop } from './loop.js'
import { createHexGridMaterial } from './hexGrid.js'

import texture1Url from './UI/texture1.png'
import texture2Url from './UI/texture2.png'

const canvas = document.querySelector('canvas.webgl')

const scene = new THREE.Scene()

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
}

const timer = new THREE.Timer();
timer.connect( document );

// Orthographic camera for fullscreen display
const aspect = sizes.width / sizes.height
const frustumSize = 2
const camera = new THREE.OrthographicCamera(
  -frustumSize * aspect / 2,
  frustumSize * aspect / 2,
  frustumSize / 2,
  -frustumSize / 2,
  0.1,
  100
)
camera.position.set(0, 0, 1)
scene.add(camera)

const renderer = new THREE.WebGPURenderer({
  canvas,
  forceWebGL: false,
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor('#222')

const inspector = new Inspector()
renderer.inspector = inspector

const postProcessing = new THREE.RenderPipeline(renderer)
postProcessing.outputColorTransform = false

const scenePass = pass(scene, camera)
const outputPass = renderOutput(scenePass)
postProcessing.outputNode = outputPass

// Load textures with proper async handling
const textureLoader = new THREE.TextureLoader()
const textures = {}

const textureUrls = { texture1: texture1Url, texture2: texture2Url }

function loadTexture(name) {
  return new Promise((resolve) => {
    textures[name] = textureLoader.load(textureUrls[name], (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      resolve(tex)
    })
  })
}

// Load both textures first, then create hexGrid material
const texturesLoaded = Promise.all([
  loadTexture('texture1'),
  loadTexture('texture2')
]).then(([tex1, tex2]) => {
  return { tex1, tex2 }
})

// Base material for image textures
const imageMaterial = new THREE.MeshBasicNodeMaterial()

// Fullscreen quad
const geometry = new THREE.PlaneGeometry(frustumSize * aspect, frustumSize)
const quad = new THREE.Mesh(geometry, imageMaterial)
scene.add(quad)

function switchToImageTexture(tex) {
  quad.material = imageMaterial
  imageMaterial.colorNode = tslTexture(tex).rgb
  imageMaterial.needsUpdate = true
}

// GUI setup
let currentMode = 'texture1'
let hexGrid = null

function switchToHexGrid() {
  if (!hexGrid) return
  quad.material = hexGrid.material
  hexGrid.material.needsUpdate = true
}

function onTextureChange(mode) {
  currentMode = mode
  if (mode === 'hexGrid') {
    switchToHexGrid()
  } else if (textures[mode]) {
    switchToImageTexture(textures[mode])
  } else {
    loadTexture(mode).then(switchToImageTexture)
  }
}

// Start rendering with texture1, then initialize hexGrid once textures are ready
loadTexture('texture1').then((tex) => {
  switchToImageTexture(tex)
  startLoop({ renderer, postProcessing })
})

// Initialize hexGrid material and GUI once textures are loaded
texturesLoaded.then(({ tex1, tex2 }) => {
  hexGrid = createHexGridMaterial(tex1, tex2)
  hexGrid.aspect.value = aspect
  setupInspector(inspector, onTextureChange, hexGrid)
})

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  const newAspect = sizes.width / sizes.height
  camera.left = -frustumSize * newAspect / 2
  camera.right = frustumSize * newAspect / 2
  camera.updateProjectionMatrix()

  // Update hex grid aspect ratio
  if (hexGrid) {
    hexGrid.aspect.value = newAspect
  }

  // Resize quad to fill screen
  quad.geometry.dispose()
  quad.geometry = new THREE.PlaneGeometry(frustumSize * newAspect, frustumSize)

  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
