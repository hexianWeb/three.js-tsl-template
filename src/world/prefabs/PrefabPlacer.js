import * as THREE from 'three/webgpu'
import { placementRandom01 } from '../../utils/random.js'
import { canPlacePrefab, pickVariantIndex, makePrefabTransform } from './placementRules.js'
import { resolvePrefabMaterial, disposeBiomeTintMaterial } from './prefabMaterialTint.js'
import { resolveTreeMaterial, resolveTreeInstanceColor, disposeTreeMaterials } from './treeMaterial.js'
import {
    normalizeInstanceColors,
    pickInstanceColorIndex,
    matchesInstanceColorMesh,
    resolveInstanceColorMaterial,
    disposeInstanceColorMaterial
} from './prefabInstanceColor.js'

const sourceMeshCache = new WeakMap()

export default class PrefabPlacer {
    constructor({ config, biomeRegistry, prefabRegistry, ownsTreeMaterials = true }) {
        this.config = config
        this.biomeRegistry = biomeRegistry
        this.prefabRegistry = prefabRegistry
        this.ownsTreeMaterials = ownsTreeMaterials
        this.group = new THREE.Group()
        this.group.name = 'BiomePrefabs'
        this.chunkGroups = new Map()
        this.instanceColorConfigCache = new WeakMap()
        this.missingInstanceColorMeshWarnings = new Set()
    }

    build(terrainMap) {
        return this.buildChunk('default', terrainMap)
    }

    buildChunk(chunkKey, terrainMap) {
        const state = this.prepareChunkBuild(chunkKey, terrainMap)

        while (!this.buildNextBucket(state)) {
            // Synchronous path used by initial/immediate chunk builds.
        }

        return this.group
    }

    prepareBuild(terrainMap) {
        return this.prepareChunkBuild('default', terrainMap)
    }

    prepareChunkBuild(chunkKey, terrainMap) {
        this.removeChunk(chunkKey)
        const chunkGroup = new THREE.Group()
        chunkGroup.name = `BiomePrefabs:${chunkKey}`
        this.chunkGroups.set(chunkKey, chunkGroup)
        this.group.add(chunkGroup)
        return {
            chunkKey,
            chunkGroup,
            buckets: [...this.collectTransforms(terrainMap).values()],
            index: 0
        }
    }

    buildNextBucket(state) {
        if (!state || state.index >= state.buckets.length) {
            return true
        }

        const bucket = state.buckets[state.index]
        state.index += 1

        const prefab = this.prefabRegistry.get(bucket.prefabId)
        const gltf = this.prefabRegistry.getVariantAsset(bucket.prefabId, bucket.variantIndex)
        if (prefab && gltf?.scene) {
            state.chunkGroup.add(
              this.buildVariantInstances(
                gltf.scene,
                bucket.transforms,
                prefab.entry,
                bucket.tint,
                bucket.prefabId,
                bucket.biomeId
              )
            )
        }

        return state.index >= state.buckets.length
    }

    collectTransforms(terrainMap) {
        const buckets = new Map()
        const { width, depth } = terrainMap
        const seed = this.config.seed

        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const worldBlock = typeof terrainMap.toWorldBlock === 'function'
                    ? terrainMap.toWorldBlock(x, z)
                    : { x, z }
                const biomeCell = terrainMap.getBiomeCell(x, z)
                const biome = this.biomeRegistry.get(biomeCell.biomeId)
                const surfaceCell = terrainMap.getSurfaceCell(x, z)

                for (const rule of biome.prefabs) {
                    const prefab = this.prefabRegistry.get(rule.id)
                    if (!prefab) {
                        continue
                    }

                    if (this.config.placement.enableTrees === false && prefab.entry.category === 'tree') {
                        continue
                    }

                    if (!canPlacePrefab(rule, prefab.entry, biomeCell, surfaceCell)) {
                        continue
                    }

                    if (placementRandom01(worldBlock.x, worldBlock.z, seed, rule.id) > rule.density) {
                        continue
                    }

                    const variantIndex = pickVariantIndex(prefab.entry, worldBlock.x, worldBlock.z, seed)
                    const placementHeight = surfaceCell.isWater
                        ? this.config.terrain.waterLevel
                        : surfaceCell.height
                    const transform = makePrefabTransform({
                        x,
                        z,
                        height: placementHeight,
                        manifestEntry: prefab.entry,
                        config: this.config,
                        seed,
                        randomX: worldBlock.x,
                        randomZ: worldBlock.z,
                        worldX: worldBlock.x,
                        worldZ: worldBlock.z
                    })
                    const instanceColors = this.getInstanceColors(prefab.entry)
                    if (instanceColors) {
                        transform.instanceColorIndex = pickInstanceColorIndex(
                            worldBlock.x,
                            worldBlock.z,
                            seed,
                            rule.id,
                            instanceColors.palette.length
                        )
                    }

                    const tint = prefab.entry.biomeTints?.[biomeCell.biomeId] ?? null
                    const isTree = prefab.entry.category === 'tree'
                    const bucketBiomeId = tint || isTree ? biomeCell.biomeId : null
                    const key = bucketBiomeId
                        ? `${rule.id}:${variantIndex}:${bucketBiomeId}`
                        : `${rule.id}:${variantIndex}`
                    if (!buckets.has(key)) {
                        buckets.set(key, {
                            prefabId: rule.id,
                            variantIndex,
                            biomeId: bucketBiomeId,
                            tint,
                            transforms: []
                        })
                    }
                    buckets.get(key).transforms.push(transform)
                    break
                }
            }
        }

        return buckets
    }

    buildVariantInstances(sourceScene, transforms, prefabEntry, tint, prefabId = 'unknown', biomeId = null) {
        const variantGroup = new THREE.Group()
        const instanceColors = this.getInstanceColors(prefabEntry)
        let matchedInstanceColorMesh = false
        const instanceMatrix = new THREE.Matrix4()
        const composed = new THREE.Matrix4()
        const position = new THREE.Vector3()
        const quaternion = new THREE.Quaternion()
        const unitScale = new THREE.Vector3(1, 1, 1)
        const yAxis = new THREE.Vector3(0, 1, 0)

        for (const { mesh: child, matrixWorld } of this.getSourceMeshEntries(sourceScene)) {

            const usesInstanceColor = instanceColors
                ? matchesInstanceColorMesh(child.name, instanceColors.meshNameSuffix)
                : false
            if (usesInstanceColor) {
                matchedInstanceColorMesh = true
            }
            const biome = biomeId ? this.biomeRegistry.get(biomeId) : null
            const isTree = prefabEntry.category === 'tree'
            const material = isTree
                ? resolveTreeMaterial(child, biomeId) ?? resolvePrefabMaterial(child.material, tint)
                : usesInstanceColor
                    ? resolveInstanceColorMaterial(child.material)
                    : resolvePrefabMaterial(child.material, tint)
            const mesh = new THREE.InstancedMesh(child.geometry, material, transforms.length)
            mesh.castShadow = true
            mesh.receiveShadow = false
            transforms.forEach((t, i) => {
                position.fromArray(t.position)
                quaternion.setFromAxisAngle(yAxis, t.rotationY)
                instanceMatrix.compose(position, quaternion, unitScale)
                composed.multiplyMatrices(instanceMatrix, matrixWorld)
                mesh.setMatrixAt(i, composed)
                if (isTree && biome) {
                    const treeColor = resolveTreeInstanceColor(
                        child,
                        biome,
                        t.worldX ?? t.x ?? 0,
                        t.y ?? 0,
                        t.worldZ ?? t.z ?? 0,
                        this.config.seed
                    )
                    if (treeColor) {
                        mesh.setColorAt(i, treeColor)
                    }
                } else if (usesInstanceColor) {
                    const colorIndex = Number.isInteger(t.instanceColorIndex)
                        ? t.instanceColorIndex
                        : 0
                    mesh.setColorAt(i, instanceColors.palette[colorIndex] ?? instanceColors.palette[0])
                }
            })
            mesh.instanceMatrix.needsUpdate = true
            if (mesh.instanceColor) {
                mesh.instanceColor.needsUpdate = true
            }
            variantGroup.add(mesh)
        }

        if (instanceColors && !matchedInstanceColorMesh) {
            const warningKey = `${prefabId}:${instanceColors.meshNameSuffix}`
            if (!this.missingInstanceColorMeshWarnings.has(warningKey)) {
                this.missingInstanceColorMeshWarnings.add(warningKey)
                console.warn(
                    `Prefab ${prefabId} has no mesh matching instance color suffix ${instanceColors.meshNameSuffix}`
                )
            }
        }

        return variantGroup
    }

    getSourceMeshEntries(sourceScene) {
        if (!sourceMeshCache.has(sourceScene)) {
            sourceScene.updateMatrixWorld(true)
            const entries = []
            sourceScene.traverse((child) => {
                if (child.isMesh) {
                    entries.push({
                        mesh: child,
                        matrixWorld: child.matrixWorld.clone()
                    })
                }
            })
            sourceMeshCache.set(sourceScene, entries)
        }
        return sourceMeshCache.get(sourceScene)
    }

    getInstanceColors(prefabEntry) {
        if (!prefabEntry || typeof prefabEntry !== 'object') {
            return null
        }
        if (!this.instanceColorConfigCache.has(prefabEntry)) {
            this.instanceColorConfigCache.set(
                prefabEntry,
                normalizeInstanceColors(prefabEntry.instanceColors)
            )
        }
        return this.instanceColorConfigCache.get(prefabEntry)
    }

    clearInstances() {
        for (const key of [...this.chunkGroups.keys()]) {
            this.removeChunk(key)
        }
        for (const child of [...this.group.children]) {
            this.disposeChunkGroup(child)
            this.group.remove(child)
        }
    }

    removeChunk(chunkKey) {
        const chunkGroup = this.chunkGroups.get(chunkKey)
        if (!chunkGroup) {
            return
        }
        this.disposeChunkGroup(chunkGroup)
        this.group.remove(chunkGroup)
        this.chunkGroups.delete(chunkKey)
    }

    disposeChunkGroup(chunkGroup) {
        chunkGroup.traverse((node) => {
            if (node.isInstancedMesh) {
                disposeBiomeTintMaterial(node.material)
                disposeInstanceColorMaterial(node.material)
                node.dispose()
            }
        })
        chunkGroup.clear()
    }

    dispose() {
        this.clearInstances()
        if (this.ownsTreeMaterials) {
            disposeTreeMaterials()
        }
        this.group.parent?.remove(this.group)
    }
}
