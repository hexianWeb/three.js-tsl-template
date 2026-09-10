import * as THREE from 'three/webgpu'

function applyBakedCamera(sourceCamera, camera) {
  if (!sourceCamera) return

  sourceCamera.updateWorldMatrix(true, false)
  camera.fov = sourceCamera.fov
  camera.near = sourceCamera.near
  camera.far = Math.max(sourceCamera.far, 100)
  sourceCamera.getWorldPosition(camera.position)
  sourceCamera.getWorldQuaternion(camera.quaternion)
  camera.updateProjectionMatrix()
}

function prepareRoot(root, variantId, sharedEffects, surfaceMeshes) {
  root.traverse((object) => {
    if (!object.isMesh) return

    const { geometry } = object
    if (geometry.attributes.uv1 && !geometry.attributes.uv2) {
      geometry.setAttribute('uv2', geometry.attributes.uv1)
    }

    if (sharedEffects.attachEmissive(object, variantId)) return

    object.castShadow = true
    object.receiveShadow = true
    if (variantId === 'baked') surfaceMeshes.push(object)
  })
}

export function prepareSceneVariants({
  scene,
  modelVariants,
  camera,
  controls,
  directionalLight,
  sharedEffects,
}) {
  const roots = {
    baked: modelVariants.baked.scene,
    normal: modelVariants.normal.scene,
  }
  const bakedSurfaceMeshes = []

  for (const root of Object.values(roots)) {
    root.visible = false
    scene.add(root)
    root.updateMatrixWorld(true)
  }

  prepareRoot(roots.baked, 'baked', sharedEffects, bakedSurfaceMeshes)
  prepareRoot(roots.normal, 'normal', sharedEffects, bakedSurfaceMeshes)
  applyBakedCamera(modelVariants.baked.cameras[0], camera)

  const bounds = new THREE.Box3().setFromObject(roots.baked)
  const center = bounds.getCenter(new THREE.Vector3())
  controls.target.copy(center)
  directionalLight.target.position.copy(center)

  return {
    roots,
    bakedSurfaceMeshes,
    bounds,
  }
}
