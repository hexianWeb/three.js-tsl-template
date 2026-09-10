import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as THREE from 'three/webgpu'
import { texture } from 'three/tsl'
import { createDayNightCycle } from './dayNightCycle.js'
import { createEmissive } from './emissive.js'
import { createEnv } from './env.js'
import { createFireflies, fireflyParams } from './fireflies.js'
import { setupGui } from './gui.js'
import { createLitMaterial, getSurfaceId } from './materials.js'
import { createRenderer } from './render.js'

const ASSET_ROOT = '/portal-lightmap-test'

const { scene, directionalLight } = createEnv()
const { camera, renderer, controls, startLoop } = createRenderer()

const params = {
  caseName: 'A',
  toneMapping: 'filmic',
  exposure: 1,
  lightMapIntensity: Math.PI,
  directIntensity: 2.5,
  dayNightAuto: true,
  dayNightTime: 0.32,
  portalColor: '#7663ff',
  portalIntensity: 1.6,
  portalSpeed: 0.28,
  poleColor: '#ff4e18',
  poleIntensity: 1,
}

const meshEntries = []
let bakedSceneRoot = null
let normalSceneRoot = null
let fullBakeMap = null
let indirectMap = null
let fullBakeMaterial = null
const hybridMaterials = new Map()
const emissive = createEmissive(params)
const dayNight = createDayNightCycle({ scene, light: directionalLight, params })

function prepareExrTexture(exrTexture, channel) {
  exrTexture.colorSpace = THREE.LinearSRGBColorSpace
  exrTexture.wrapS = THREE.ClampToEdgeWrapping
  exrTexture.wrapT = THREE.ClampToEdgeWrapping
  exrTexture.generateMipmaps = false
  exrTexture.minFilter = THREE.LinearFilter
  exrTexture.magFilter = THREE.LinearFilter
  exrTexture.flipY = true
  if (channel !== undefined) {
    exrTexture.channel = channel
  }
  exrTexture.needsUpdate = true
  return exrTexture
}

function applyCase(caseName) {
  params.caseName = caseName
  const isNormalRender = caseName === 'D'

  if (bakedSceneRoot) {
    bakedSceneRoot.visible = !isNormalRender
  }
  if (normalSceneRoot) {
    normalSceneRoot.visible = isNormalRender
  }

  directionalLight.visible = caseName === 'B' || isNormalRender
  directionalLight.intensity = params.directIntensity

  emissive.setLightsVisible(caseName === 'B')
  dayNight.update(0)

  if (isNormalRender) {
    return
  }

  if (caseName === 'A') {
    if (!fullBakeMaterial) {
      return
    }
    for (const { mesh } of meshEntries) {
      mesh.material = fullBakeMaterial
    }
    return
  }

  if (!indirectMap) {
    console.error('Indirect map not loaded')
    return
  }

  for (const { mesh } of meshEntries) {
    const surfaceId = getSurfaceId(mesh.name)
    let hybrid = hybridMaterials.get(surfaceId)
    if (!hybrid) {
      hybrid = createLitMaterial(mesh.name)
      hybrid.lightMap = indirectMap
      hybridMaterials.set(surfaceId, hybrid)
    }
    hybrid.lightMap = indirectMap
    hybrid.lightMapIntensity = params.lightMapIntensity
    hybrid.needsUpdate = true
    mesh.material = hybrid
  }
}

setupGui({
  params,
  onCaseChange: applyCase,
  onEmissionUvChange: emissive.setUvDebug,
})

window.__portal = {
  scene,
  camera,
  params,
  meshEntries,
  emissiveLights: emissive.lights,
  get maps() {
    return {
      full: fullBakeMap && [fullBakeMap.image.width, fullBakeMap.image.height],
      indirect: indirectMap && [indirectMap.image.width, indirectMap.image.height],
    }
  },
}

async function init() {
  await renderer.init()

  startLoop(scene, (deltaSeconds) => {
    renderer.toneMapping = params.toneMapping === 'agx'
      ? THREE.AgXToneMapping
      : THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = params.exposure
    dayNight.update(deltaSeconds)
    emissive.sync(deltaSeconds)
    if (params.caseName === 'B' || params.caseName === 'C') {
      for (const hybrid of hybridMaterials.values()) {
        hybrid.lightMapIntensity = params.lightMapIntensity
      }
    }
  })

  const gltfLoader = new GLTFLoader()
  const exrLoader = new EXRLoader()

  const [gltf, normalGltf] = await Promise.all([
    gltfLoader.loadAsync(`${ASSET_ROOT}/portal_scene.glb`),
    gltfLoader.loadAsync(`${ASSET_ROOT}/portal_none_bake.glb`),
  ])
  bakedSceneRoot = gltf.scene
  normalSceneRoot = normalGltf.scene
  normalSceneRoot.visible = false
  scene.add(bakedSceneRoot, normalSceneRoot)
  bakedSceneRoot.updateMatrixWorld(true)
  normalSceneRoot.updateMatrixWorld(true)

  if (gltf.cameras[0]) {
    const bakedCamera = gltf.cameras[0]
    bakedCamera.updateWorldMatrix(true, false)
    camera.fov = bakedCamera.fov
    camera.near = bakedCamera.near
    camera.far = Math.max(bakedCamera.far, 100)
    bakedCamera.getWorldPosition(camera.position)
    bakedCamera.getWorldQuaternion(camera.quaternion)
    camera.updateProjectionMatrix()
  }

  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) {
      return
    }
    const { geometry } = obj
    if (geometry.attributes.uv1 && !geometry.attributes.uv2) {
      geometry.setAttribute('uv2', geometry.attributes.uv1)
    }

    if (emissive.tryAttach(obj)) {
      return
    }

    obj.castShadow = true
    obj.receiveShadow = true
    meshEntries.push({
      mesh: obj,
      original: obj.material,
    })
  })

  normalSceneRoot.traverse((obj) => {
    if (!obj.isMesh) {
      return
    }

    obj.castShadow = true
    obj.receiveShadow = true
  })

  const box = new THREE.Box3().setFromObject(bakedSceneRoot)
  createFireflies({ scene, params: fireflyParams })
  const center = box.getCenter(new THREE.Vector3())
  controls.target.copy(center)
  directionalLight.target.position.copy(center)

  window.__portal.meshCount = meshEntries.length
  window.__portal.box = box.getSize(new THREE.Vector3()).toArray()

  fullBakeMap = prepareExrTexture(
    await exrLoader.loadAsync(`${ASSET_ROOT}/lightmaps/portal_full_bake.exr`),
  )
  fullBakeMaterial = new THREE.MeshBasicNodeMaterial()
  fullBakeMaterial.colorNode = texture(fullBakeMap)
  applyCase('A')

  indirectMap = prepareExrTexture(
    await exrLoader.loadAsync(`${ASSET_ROOT}/lightmaps/portal_indirect_bake.exr`),
    1,
  )
  indirectMap.colorSpace = THREE.LinearSRGBColorSpace
  window.__portal.mapsReady = true
}

init().catch((error) => {
  console.error(error)
  window.__portal.error = error?.stack || String(error)
  const el = document.createElement('pre')
  el.textContent = error?.stack || String(error)
  el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:20;color:#ff8b8b;background:#000c;padding:12px;max-width:80vw;white-space:pre-wrap;font:12px/1.4 monospace;'
  document.body.appendChild(el)
})
