import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as THREE from 'three/webgpu'

export const ASSET_ROOT = '/portal-lightmap-test'

export function prepareExrTexture(exrTexture, channel) {
  exrTexture.colorSpace = THREE.LinearSRGBColorSpace
  exrTexture.wrapS = THREE.ClampToEdgeWrapping
  exrTexture.wrapT = THREE.ClampToEdgeWrapping
  exrTexture.generateMipmaps = false
  exrTexture.minFilter = THREE.LinearFilter
  exrTexture.magFilter = THREE.LinearFilter
  exrTexture.flipY = true
  if (channel !== undefined) exrTexture.channel = channel
  exrTexture.needsUpdate = true
  return exrTexture
}

export async function loadModelVariants() {
  const loader = new GLTFLoader()
  const [baked, normal] = await Promise.all([
    loader.loadAsync(`${ASSET_ROOT}/portal_scene.glb`),
    loader.loadAsync(`${ASSET_ROOT}/portal_none_bake.glb`),
  ])
  return { baked, normal }
}

export async function loadLightmaps() {
  const loader = new EXRLoader()
  const fullBake = prepareExrTexture(
    await loader.loadAsync(`${ASSET_ROOT}/lightmaps/portal_full_bake.exr`),
  )
  const indirect = prepareExrTexture(
    await loader.loadAsync(`${ASSET_ROOT}/lightmaps/portal_indirect_bake.exr`),
    1,
  )
  return { fullBake, indirect }
}
