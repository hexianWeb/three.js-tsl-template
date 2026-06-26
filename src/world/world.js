import * as THREE from 'three/webgpu'
import { worldConfig } from './WorldConfig.js'
import BiomeRegistry from './biomes/BiomeRegistry.js'
import BiomeBlender from './biomes/BiomeBlender.js'
import BiomeMaskGenerator from './biomes/BiomeMaskGenerator.js'
import TerrainGenerator from './terrain/TerrainGenerator.js'
import LayeredTerrainBuilder from './terrain/LayeredTerrainBuilder.js'
import { extractBrickGeometry } from './bricks/BrickGeometry.js'
import BrickColorResolver from './bricks/BrickColorResolver.js'
import HeightfieldAO from './bricks/HeightfieldAO.js'
import TerrainBrickRenderer from './bricks/TerrainBrickRenderer.js'
import WaterBrickRenderer from './bricks/WaterBrickRenderer.js'
import LavaBrickRenderer from './bricks/LavaBrickRenderer.js'
import PrefabRegistry from './prefabs/PrefabRegistry.js'
import PrefabPlacer from './prefabs/PrefabPlacer.js'
import PlayerAircraft from './player/PlayerAircraft.js'
import ChunkManager from './chunks/ChunkManager.js'
import RenderChunk from './chunks/RenderChunk.js'
import { createLegoMaterial } from '../materials/tsl/legoMaterial.js'
import { createWaterMaterial } from '../materials/tsl/waterMaterial.js'
import { createLavaMaterial } from '../materials/tsl/lavaMaterial.js'
import {
    getRenderChunkOrigin,
    parseRenderChunkKey
} from './chunks/chunkCoordinates.js'
import { createTerrainPanel } from '../debug/panels/TerrainPanel.js'
import { createAOPanel } from '../debug/panels/AOPanel.js'
import { createBiomePanel } from '../debug/panels/BiomePanel.js'
import { createPlacementPanel } from '../debug/panels/PlacementPanel.js'
import { createMaterialPanel } from '../debug/panels/MaterialPanel.js'

export default class World {
    /**
     * @param {import('../app/Experience.js').default} experience
     */
    constructor(experience) {
        this.experience = experience
        this.scene = experience.scene
        this.group = new THREE.Group()
        this.group.name = 'World'
        this.scene.add(this.group)

        this.children = []
        this.config = worldConfig
        this.terrainMap = null
        this.terrainPlacements = []

        this.brickGeometry = null
        this.biomeRegistry = null
        this.biomeBlender = null
        this.biomeMaskGenerator = null
        this.terrainGenerator = null
        this.layeredTerrainBuilder = null
        this.brickColorResolver = null
        this.heightfieldAO = null
        this.terrainBrickRenderer = null
        this.waterBrickRenderer = null
        this.lavaBrickRenderer = null
        this.prefabPlacer = null
        this.prefabRegistry = null
        this.chunkManager = null
        this.renderChunks = new Map()
        this.pendingLoadKeys = []
        this.pendingLoadKeySet = new Set()
        this.pendingBuildJobs = []
        this.pendingBuildKeySet = new Set()
        this.pendingUnloadKeys = []
        this.pendingUnloadKeySet = new Set()
        this.desiredActiveKeys = new Set()
        this.sharedChunkMaterials = null
        this.playerAircraft = null
    }

    addSystem(system) {
        this.children.push(system)
        if (system.group) {
            this.group.add(system.group)
        }
    }

    build() {
        const resources = this.experience.resources

        if (!this.brickGeometry) {
            this.brickGeometry = extractBrickGeometry(resources.items.brick2x2Model, this.config.terrain.cellSize)
        }

        if (!this.brickGeometry) {
            console.warn('[World] Missing brick geometry; terrain render skipped.')
            return
        }

        if (!this.chunkManager) {
            this.biomeRegistry = new BiomeRegistry()
            this.biomeBlender = new BiomeBlender(this.biomeRegistry)
            this.biomeMaskGenerator = new BiomeMaskGenerator(this.config)
            this.terrainGenerator = new TerrainGenerator({
                config: this.config,
                biomeMaskGenerator: this.biomeMaskGenerator,
                biomeBlender: this.biomeBlender,
                biomeRegistry: this.biomeRegistry
            })
            this.layeredTerrainBuilder = new LayeredTerrainBuilder({ config: this.config })
            this.brickColorResolver = new BrickColorResolver({
                biomeRegistry: this.biomeRegistry,
                biomeBlender: this.biomeBlender,
                config: this.config
            })
            if (this.config.placement.enablePrefabs !== false) {
                this.prefabRegistry = new PrefabRegistry(resources)
            }
            this.chunkManager = new ChunkManager(this.config.terrain.renderChunk)
            this.sharedChunkMaterials = {
                terrain: createLegoMaterial(),
                terrainPreview: new THREE.MeshBasicNodeMaterial(),
                water: createWaterMaterial(this.config.water, resources.items.waterNoiseTexture),
                lava: createLavaMaterial(this.biomeRegistry.get('volcano').lava, resources.items.lavaNoiseTexture)
            }

            this.playerAircraft = new PlayerAircraft(this.experience, { config: this.config })
            this.addSystem(this.playerAircraft)
        }

        this.regenerate()
    }

    regenerate() {
        if (!this.terrainGenerator || !this.chunkManager) {
            return
        }

        this.clearRenderChunks()
        this.clearChunkQueues()
        this.chunkManager = new ChunkManager(this.config.terrain.renderChunk)
        this.updateRenderChunks({ forceFallbackOrigin: true, immediate: true })

        const anchorOrigin = this.chunkManager?.anchorCoord
            ? getRenderChunkOrigin(this.chunkManager.anchorCoord, this.config.terrain.renderChunk.size)
            : { x: 0, z: 0 }
        const centerX = (anchorOrigin.x + this.config.terrain.renderChunk.size * 0.5) * this.config.terrain.cellSize
        const centerZ = (anchorOrigin.z + this.config.terrain.renderChunk.size * 0.5) * this.config.terrain.cellSize
        this.experience.worldCamera.lookAt(new THREE.Vector3(centerX, 0, centerZ))
        this.refreshAOPreview()
    }

    refreshAOPreview() {
        const preview = this.config.terrain.ao?.previewGrayscale === true

        for (const chunk of this.renderChunks.values()) {
            chunk.updateInstanceColors()
            chunk.setPreviewVisible(preview)
        }
        if (this.playerAircraft?.group) {
            this.playerAircraft.group.visible = !preview
        }
    }

    createRenderChunk(key) {
        const profileMs = import.meta.env.DEV ? {} : null
        let phaseStart = performance.now()

        const chunkConfig = this.config.terrain.renderChunk
        const coord = parseRenderChunkKey(key)
        const origin = getRenderChunkOrigin(coord, chunkConfig.size)
        const terrainMap = this.terrainGenerator.generate({
            originX: origin.x,
            originZ: origin.z,
            width: chunkConfig.size,
            depth: chunkConfig.size,
            halo: chunkConfig.halo ?? 0
        })
        if (profileMs) {
            profileMs['terrain.generate'] = performance.now() - phaseStart
            phaseStart = performance.now()
        }

        const placements = this.layeredTerrainBuilder.buildPlacements(terrainMap)
        if (profileMs) {
            profileMs['placements.build'] = performance.now() - phaseStart
            phaseStart = performance.now()
        }

        const heightfieldAO = new HeightfieldAO({ config: this.config })
        heightfieldAO.build(terrainMap)
        if (profileMs) {
            profileMs['heightfieldAO.build'] = performance.now() - phaseStart
            phaseStart = performance.now()
        }

        const renderChunk = new RenderChunk({
            key,
            origin,
            cellSize: this.config.terrain.cellSize,
            renderers: this.createRenderChunkRenderers()
        })
        if (profileMs) {
            profileMs['renderChunk.construct'] = performance.now() - phaseStart
            phaseStart = performance.now()
        }

        renderChunk.build({
            terrainMap,
            placements,
            colorResolver: this.brickColorResolver,
            heightfieldAO,
            profileMs
        })
        if (profileMs) {
            profileMs['renderChunk.build'] =
                (profileMs['render.terrain'] ?? 0) +
                (profileMs['render.water'] ?? 0) +
                (profileMs['render.lava'] ?? 0) +
                (profileMs['render.prefabs'] ?? 0)
            phaseStart = performance.now()
        }

        renderChunk.setPreviewVisible(this.config.terrain.ao?.previewGrayscale === true)
        this.renderChunks.set(key, renderChunk)
        this.group.add(renderChunk.group)

        if (profileMs) {
            profileMs['scene.attach'] = performance.now() - phaseStart
            this.logRenderChunkBuildProfile(key, profileMs, {
                placements: placements.length,
                origin
            })
        }

        return renderChunk
    }

    createRenderChunkRenderers() {
        const renderers = {
            terrain: new TerrainBrickRenderer({
                config: this.config,
                brickGeometry: this.brickGeometry,
                material: this.sharedChunkMaterials.terrain,
                previewMaterial: this.sharedChunkMaterials.terrainPreview,
                ownsMaterials: false
            }),
            water: new WaterBrickRenderer({
                config: this.config,
                brickGeometry: this.brickGeometry,
                material: this.sharedChunkMaterials.water,
                ownsMaterial: false
            }),
            lava: new LavaBrickRenderer({
                config: this.config,
                brickGeometry: this.brickGeometry,
                material: this.sharedChunkMaterials.lava,
                ownsMaterial: false
            })
        }

        if (this.config.placement.enablePrefabs !== false) {
            renderers.prefabs = new PrefabPlacer({
                config: this.config,
                biomeRegistry: this.biomeRegistry,
                prefabRegistry: this.prefabRegistry,
                ownsTreeMaterials: false
            })
        }

        return renderers
    }

    createRenderChunkBuildJob(key) {
        const profileMs = import.meta.env.DEV ? {} : null
        const chunkConfig = this.config.terrain.renderChunk
        const coord = parseRenderChunkKey(key)
        const origin = getRenderChunkOrigin(coord, chunkConfig.size)
        return {
            key,
            profileMs,
            origin,
            chunkConfig,
            phase: 'terrain',
            terrainMap: null,
            placements: null,
            heightfieldAO: null,
            renderChunk: null
        }
    }

    stepRenderChunkBuildJob(job) {
        const timed = (label, fn) => {
            if (!job.profileMs) {
                return fn()
            }
            const start = performance.now()
            const result = fn()
            job.profileMs[label] = performance.now() - start
            return result
        }

        if (job.phase === 'terrain') {
            job.terrainMap = timed('terrain.generate', () => this.terrainGenerator.generate({
                originX: job.origin.x,
                originZ: job.origin.z,
                width: job.chunkConfig.size,
                depth: job.chunkConfig.size,
                halo: job.chunkConfig.halo ?? 0
            }))
            job.phase = 'placements'
            return false
        }

        if (job.phase === 'placements') {
            job.placements = timed('placements.build', () =>
                this.layeredTerrainBuilder.buildPlacements(job.terrainMap))
            job.phase = 'ao'
            return false
        }

        if (job.phase === 'ao') {
            job.heightfieldAO = new HeightfieldAO({ config: this.config })
            timed('heightfieldAO.build', () => job.heightfieldAO.build(job.terrainMap))
            job.phase = 'render'
            return false
        }

        if (job.phase === 'render') {
            job.renderChunk = timed('renderChunk.construct', () => new RenderChunk({
                key: job.key,
                origin: job.origin,
                cellSize: this.config.terrain.cellSize,
                renderers: this.createRenderChunkRenderers()
            }))
            timed('render.terrain', () => {
                job.renderChunk.addRendererGroup(
                    job.renderChunk.renderers.terrain?.build(
                        job.placements,
                        this.brickColorResolver,
                        job.heightfieldAO
                    )
                )
            })
            job.phase = 'renderWaterLava'
            return false
        }

        if (job.phase === 'renderWaterLava') {
            timed('render.water', () => {
                job.renderChunk.addRendererGroup(job.renderChunk.renderers.water?.build(job.terrainMap))
            })
            timed('render.lava', () => {
                job.renderChunk.addRendererGroup(job.renderChunk.renderers.lava?.build(job.terrainMap))
            })
            if (this.config.placement.enablePrefabs !== false) {
                job.renderChunk.addRendererGroup(job.renderChunk.renderers.prefabs?.group)
                job.phase = 'prefabPrepare'
            } else {
                job.phase = 'attach'
            }
            return false
        }

        if (job.phase === 'prefabPrepare') {
            job.prefabState = timed('render.prefabs.collect', () =>
                job.renderChunk.renderers.prefabs?.prepareChunkBuild(job.key, job.terrainMap))
            job.phase = 'prefabBucket'
            return false
        }

        if (job.phase === 'prefabBucket') {
            const done = timed('render.prefabs.bucket', () =>
                job.renderChunk.renderers.prefabs?.buildNextBucket(job.prefabState) ?? true)
            if (done) {
                job.phase = 'attach'
            }
            return false
        }

        if (job.phase === 'attach') {
            timed('scene.attach', () => {
                job.renderChunk.setPreviewVisible(this.config.terrain.ao?.previewGrayscale === true)
                this.renderChunks.set(job.key, job.renderChunk)
                this.group.add(job.renderChunk.group)
            })
            if (job.profileMs) {
                this.logRenderChunkBuildProfile(job.key, job.profileMs, {
                    placements: job.placements.length,
                    origin: job.origin
                })
            }
            return true
        }

        return true
    }

    logRenderChunkBuildProfile(key, profileMs, stats = {}) {
        const entries = Object.entries(profileMs).sort(([, a], [, b]) => b - a)
        const total = entries.reduce((sum, [, ms]) => sum + ms, 0)
        const originLabel = stats.origin
            ? `@ [${stats.origin.x}, ${stats.origin.z}]`
            : ''
        const placementLabel = Number.isFinite(stats.placements)
            ? `, ${stats.placements} bricks`
            : ''

        console.groupCollapsed(
            `[ChunkBuild] ${key}${originLabel} — ${total.toFixed(1)}ms${placementLabel}`
        )
        for (const [label, ms] of entries) {
            const pct = total > 0 ? ((ms / total) * 100).toFixed(0) : '0'
            console.log(`${label.padEnd(22)} ${ms.toFixed(1).padStart(7)}ms  (${pct}%)`)
        }
        console.groupEnd()
    }

    updateRenderChunks({ forceFallbackOrigin = false, immediate = false } = {}) {
        if (!this.chunkManager) {
            return
        }

        const position = this.playerAircraft?.state?.position
        const cellSize = this.config.terrain.cellSize
        const worldBlock = position && !forceFallbackOrigin
            ? {
                x: Math.floor(position.x / cellSize),
                z: Math.floor(position.z / cellSize)
            }
            : { x: 0, z: 0 }
        const velocity = this.playerAircraft?.state?.velocity
        const movement = velocity && !forceFallbackOrigin
            ? { x: velocity.x / cellSize, z: velocity.z / cellSize }
            : null
        const result = this.chunkManager.update(worldBlock, this.experience.time.getDelta(), movement)
        this.desiredActiveKeys = new Set(result.activeKeys)

        this.enqueueRenderChunkUnloads(result.unloadKeys)
        this.enqueueRenderChunkLoads(result.loadKeys)
        this.processPendingRenderChunkLoads(immediate)
        this.flushPendingRenderChunkUnloads()

        if (result.changed) {
            this.configureChunkShadows(result.anchorCoord)
        }
    }

    enqueueRenderChunkLoads(keys) {
        for (const key of keys) {
            if (this.renderChunks.has(key) || this.pendingLoadKeySet.has(key)) {
                continue
            }
            this.pendingLoadKeys.push(key)
            this.pendingLoadKeySet.add(key)
        }
    }

    enqueueRenderChunkUnloads(keys) {
        for (const key of keys) {
            if (this.pendingUnloadKeySet.has(key)) {
                continue
            }
            this.pendingUnloadKeys.push(key)
            this.pendingUnloadKeySet.add(key)
        }
    }

    processPendingRenderChunkLoads(immediate = false) {
        const configuredLimit = this.config.terrain.renderChunk.buildsPerFrame ?? 1
        const limit = immediate ? Infinity : Math.max(1, configuredLimit)
        let built = 0

        if (immediate) {
            while (this.pendingLoadKeys.length > 0 && built < limit) {
                const key = this.pendingLoadKeys.shift()
                this.pendingLoadKeySet.delete(key)
                if (this.renderChunks.has(key)) {
                    continue
                }
                this.createRenderChunk(key)
                built += 1
            }
            return
        }

        while (this.pendingBuildJobs.length === 0 && this.pendingLoadKeys.length > 0 && built < limit) {
            const key = this.pendingLoadKeys.shift()
            this.pendingLoadKeySet.delete(key)
            if (this.renderChunks.has(key)) {
                continue
            }
            this.pendingBuildJobs.push(this.createRenderChunkBuildJob(key))
            this.pendingBuildKeySet.add(key)
            built += 1
        }

        if (this.pendingBuildJobs.length === 0) {
            return
        }

        const job = this.pendingBuildJobs[0]
        const complete = this.stepRenderChunkBuildJob(job)
        if (complete) {
            this.pendingBuildJobs.shift()
            this.pendingBuildKeySet.delete(job.key)
        }
    }

    flushPendingRenderChunkUnloads() {
        if (this.pendingLoadKeys.length > 0 || this.pendingBuildJobs.length > 0) {
            return
        }

        const remaining = []
        this.pendingUnloadKeySet.clear()
        for (const key of this.pendingUnloadKeys) {
            if (this.desiredActiveKeys.has(key)) {
                continue
            }
            const chunk = this.renderChunks.get(key)
            chunk?.dispose()
            this.renderChunks.delete(key)
        }
        this.pendingUnloadKeys = remaining
    }

    configureChunkShadows(anchorCoord) {
        const terrain = this.config.terrain
        const chunkConfig = terrain.renderChunk
        const anchorOrigin = getRenderChunkOrigin(anchorCoord, chunkConfig.size)
        const centerX = (anchorOrigin.x + chunkConfig.size * 0.5) * terrain.cellSize
        const centerZ = (anchorOrigin.z + chunkConfig.size * 0.5) * terrain.cellSize
        const halfExtent = (chunkConfig.size * 2) * terrain.cellSize * 0.6
        this.experience.environment.configureShadows({
            centerX,
            centerZ,
            halfExtent,
            maxHeight: terrain.maxHeight * terrain.layerHeight + 8
        })
    }

    clearRenderChunks() {
        for (const chunk of this.renderChunks.values()) {
            chunk.dispose()
        }
        this.renderChunks.clear()
    }

    clearChunkQueues() {
        this.pendingLoadKeys.length = 0
        this.pendingLoadKeySet.clear()
        this.pendingBuildJobs.length = 0
        this.pendingBuildKeySet.clear()
        this.pendingUnloadKeys.length = 0
        this.pendingUnloadKeySet.clear()
        this.desiredActiveKeys.clear()
    }

    getDebugMaterials() {
        const firstChunk = this.renderChunks.values().next().value
        return {
            legoMaterial: this.sharedChunkMaterials?.terrain ?? firstChunk?.legoMaterial ?? null,
            waterMaterial: this.sharedChunkMaterials?.water ?? firstChunk?.waterMaterial ?? null
        }
    }

    /**
     * @param {import('../debug/Debug.js').default} debug
     */
    debuggerInit(debug) {
        if (!debug.active) {
            return
        }

        const onRegenerate = () => this.regenerate()
        const onAOPreviewChange = () => this.refreshAOPreview()

        createTerrainPanel(debug, this.config, onRegenerate)
        createAOPanel(debug, this.config, onRegenerate, onAOPreviewChange)
        createBiomePanel(debug, this.config, onRegenerate)
        createPlacementPanel(debug, this.config, onRegenerate)
        createMaterialPanel(debug, this.config, this.getDebugMaterials())

        for (const child of this.children) {
            child.debuggerInit?.(debug)
        }
    }

    update() {
        for (const child of this.children) {
            child.update?.()
        }
        this.updateRenderChunks()
    }

    dispose() {
        this.clearRenderChunks()
        this.disposeSharedChunkMaterials()
        for (const child of this.children) {
            child.dispose?.()
        }
        this.children.length = 0
        this.scene.remove(this.group)
    }

    disposeSharedChunkMaterials() {
        if (!this.sharedChunkMaterials) {
            return
        }
        this.sharedChunkMaterials.terrain?.dispose()
        this.sharedChunkMaterials.terrainPreview?.dispose()
        this.sharedChunkMaterials.water?.dispose()
        this.sharedChunkMaterials.lava?.dispose()
        this.sharedChunkMaterials = null
    }
}
