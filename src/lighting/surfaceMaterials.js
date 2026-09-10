import * as THREE from 'three/webgpu'
import { texture } from 'three/tsl'

export const LIGHTMAP_INTENSITY = Math.PI

export const materialProfiles = {
  grass: {
    color: [0.8, 0.7798, 0.0602],
    roughness: 1,
    metalness: 0,
  },
  rock: {
    color: [0.42, 0.42, 0.42],
    roughness: 0.5,
    metalness: 0,
  },
  wood: {
    color: [0.8, 0.18116, 0.067],
    roughness: 1,
    metalness: 0,
  },
  metal: {
    color: [0.13286, 0.13286, 0.13286],
    roughness: 0.274,
    metalness: 0,
  },
}

const WOOD_MESHES = new Set(
  [
    'Cube',
    'Cube.001',
    'Cube.002',
    'Cube.003',
    'Cube.004',
    'Cube.007',
    'Cube.009',
    'Cube.012',
    'Cube.046',
    'Cylinder',
    'Cylinder.001',
    'Cylinder.002',
    'Cylinder.003',
    'Cylinder.004',
    'Cylinder.005',
    'Cylinder.006',
    'Cylinder.007',
  ].map(normalizeName),
)

const METAL_MESHES = new Set(['Cube.006', 'Cube.010', 'Cube.013'].map(normalizeName))
const GRASS_MESHES = new Set(['Plane'].map(normalizeName))

export function normalizeName(name) {
  return String(name || '').replace(/\./g, '')
}

export function getSurfaceId(meshName) {
  const name = normalizeName(meshName)
  if (GRASS_MESHES.has(name)) return 'grass'
  if (WOOD_MESHES.has(name)) return 'wood'
  if (METAL_MESHES.has(name)) return 'metal'
  return 'rock'
}

export function createLitMaterial(meshName) {
  const id = getSurfaceId(meshName)
  const profile = materialProfiles[id]
  const material = new THREE.MeshStandardNodeMaterial()
  material.name = `indirect-${id}`
  material.color = new THREE.Color().setRGB(...profile.color, THREE.LinearSRGBColorSpace)
  material.roughness = profile.roughness
  material.metalness = profile.metalness
  return material
}

export function createFullBakeMaterial(lightmap) {
  const material = new THREE.MeshBasicNodeMaterial()
  material.name = 'full-bake-surface'
  material.colorNode = texture(lightmap)
  return material
}

export function createIndirectMaterialLibrary(lightmap) {
  const materials = new Map()

  return {
    materials,
    get(meshName, intensity) {
      const surfaceId = getSurfaceId(meshName)
      let material = materials.get(surfaceId)
      if (!material) {
        material = createLitMaterial(meshName)
        material.lightMap = lightmap
        materials.set(surfaceId, material)
      }
      material.lightMapIntensity = intensity
      material.needsUpdate = true
      return material
    },
    setIntensity(intensity) {
      for (const material of materials.values()) {
        material.lightMapIntensity = intensity
      }
    },
  }
}
